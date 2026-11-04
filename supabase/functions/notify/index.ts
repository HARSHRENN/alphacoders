// Supabase Edge Function. Secrets and service-role credentials stay on the server.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@6';
import { fcmMessage } from './pushPayload.ts';
const firebaseProject = 'alphacoders-593b1';
let cachedGoogleToken: { token: string; expires: number } | null = null;
async function googleToken() {
  if (cachedGoogleToken && cachedGoogleToken.expires > Date.now() + 60000)
    return cachedGoogleToken.token;
  const account = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
  if (account.project_id !== firebaseProject)
    throw new Error('Firebase server configuration missing');
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(await importPKCS8(account.private_key, 'RS256'));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Firebase server authentication failed');
  const result = await response.json();
  cachedGoogleToken = {
    token: result.access_token,
    expires: Date.now() + result.expires_in * 1000,
  };
  return cachedGoogleToken.token;
}
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const pushHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
if (Deno.env.get('EXPO_ACCESS_TOKEN'))
  pushHeaders.Authorization = `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`;
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let runId: unknown;
  try {
    runId = (await req.json()).run_id;
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
  if (
    typeof runId !== 'string' ||
    !/^\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b$/i.test(runId)
  )
    return new Response('Unauthorized', { status: 401 });
  const ticket = await db.rpc('consume_notification_run', { run_id: runId });
  if (ticket.error || ticket.data !== true) return new Response('Unauthorized', { status: 401 });
  if (!Deno.env.get('FIREBASE_SERVICE_ACCOUNT'))
    return Response.json(
      { error: 'Firebase server credential is not configured' },
      { status: 503 },
    );
  try {
    const { error: enqueueError } = await db.rpc('enqueue_reminders');
    if (enqueueError) throw enqueueError;
    const { data: jobs, error } = await db.rpc('claim_notification_jobs');
    if (error) throw error;
    let accepted = 0,
      failed = 0;
    for (const job of jobs ?? []) {
      try {
        const { data: profile, error: pe } = await db
          .from('profiles')
          .select('notifications_enabled')
          .eq('id', job.user_id)
          .single();
        if (pe) throw pe;
        const { data: tokens, error: te } = await db
          .from('push_tokens')
          .select('token,provider')
          .eq('user_id', job.user_id);
        if (te) throw te;
        if (profile.notifications_enabled && tokens?.length) {
          for (const device of tokens.filter((t) => t.provider === 'fcm')) {
            const response = await fetch(
              `https://fcm.googleapis.com/v1/projects/${firebaseProject}/messages:send`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${await googleToken()}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(fcmMessage(device.token, job)),
                signal: AbortSignal.timeout(10000),
              },
            );
            if (!response.ok) {
              const result = await response.json();
              if (
                result.error?.details?.some(
                  (d: { errorCode?: string }) => d.errorCode === 'UNREGISTERED',
                )
              ) {
                const removed = await db.from('push_tokens').delete().eq('token', device.token);
                if (removed.error) throw removed.error;
              } else throw new Error('FCM delivery failed');
            }
          }
          const expoTokens = tokens.filter((t) => t.provider === 'expo');
          for (let i = 0; i < expoTokens.length; i += 100) {
            const chunk = expoTokens.slice(i, i + 100);
            const response = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: pushHeaders,
              body: JSON.stringify(
                chunk.map((t) => ({
                  to: t.token,
                  title: job.title,
                  body: job.body,
                  data: job.data,
                  sound: 'default',
                  channelId: 'work-updates',
                  ttl: 3600,
                })),
              ),
            });
            const result = await response.json();
            if (!response.ok || result.errors || !Array.isArray(result.data))
              throw new Error('Push gateway unavailable');
            for (let j = 0; j < result.data.length; j++) {
              const ticket = result.data[j];
              if (ticket.status === 'error') {
                if (ticket.details?.error === 'DeviceNotRegistered')
                  await db.from('push_tokens').delete().eq('token', chunk[j].token);
                else throw new Error(ticket.details?.error || 'Push rejected');
              }
            }
          }
        }
        const { error: e } = await db
          .from('notification_jobs')
          .update({ status: 'sent', locked_until: null })
          .eq('id', job.id);
        if (e) throw e;
        accepted++;
      } catch {
        const { error: e } = await db
          .from('notification_jobs')
          .update({
            status: job.attempts >= 5 ? 'failed' : 'pending',
            locked_until: null,
            available_at: new Date(
              Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000,
            ).toISOString(),
          })
          .eq('id', job.id);
        if (e) console.error('Could not release notification job', job.id);
        failed++;
      }
    }
    return Response.json({ accepted, failed });
  } catch (e) {
    console.error('Notification worker failed');
    return Response.json({ error: 'Notification worker failed' }, { status: 500 });
  }
});
