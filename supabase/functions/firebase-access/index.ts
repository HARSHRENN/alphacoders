import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'npm:jose@6';

const projectId = 'alphacoders-593b1';
const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (status: number, message: string) => new Response(JSON.stringify({ message }), { status, headers });
let cached: { token: string; expires: number } | null = null;

async function adminToken() {
  if (cached && cached.expires > Date.now() + 60000) return cached.token;
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) throw new Error('Firebase server credentials are not configured');
  const sa = JSON.parse(raw);
  if (sa.project_id !== projectId || typeof sa.client_email !== 'string') throw new Error('Wrong Firebase server project');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/identitytoolkit' })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h')
    .sign(await importPKCS8(sa.private_key, 'RS256'));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw new Error('Firebase server authentication failed');
  const result = await response.json();
  cached = { token: result.access_token, expires: Date.now() + result.expires_in * 1000 };
  return cached.token;
}

// Public gateway, independently authenticated with Google's signed Firebase ID
// token. No request may select a target UID, project or workspace role.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, 'POST required');
  const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token || token.length > 16000) return reply(401, 'Sign in first');
  let subject: string; let authTime: number;
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'], issuer: `https://securetoken.google.com/${projectId}`, audience: projectId,
      requiredClaims: ['sub', 'iat', 'exp', 'auth_time'],
    });
    if (!payload.sub || payload.sub.length > 128 || payload.email_verified !== true ||
      typeof payload.iat !== 'number' || payload.iat > Date.now() / 1000 ||
      typeof payload.auth_time !== 'number' || payload.auth_time > Date.now() / 1000) return reply(403, 'Verify your email first');
    subject = payload.sub; authTime = payload.auth_time;
  } catch { return reply(401, 'Invalid sign-in token'); }
  try {
    const authorization = `Bearer ${await adminToken()}`;
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, {
      method: 'POST', headers: { authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [subject] }),
    });
    if (!lookup.ok) throw new Error('Firebase account lookup failed');
    const user = (await lookup.json()).users?.[0];
    if (!user || user.localId !== subject || user.disabled || !user.emailVerified || Number(user.validSince || 0) > authTime) return reply(403, 'Account is not authorized');
    const claims = JSON.parse(user.customAttributes || '{}');
    if (claims.role !== 'authenticated') {
      const update = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, {
        method: 'POST', headers: { authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: subject, customAttributes: JSON.stringify({ ...claims, role: 'authenticated' }) }),
      });
      if (!update.ok) throw new Error('Firebase access setup failed');
    }
    return reply(200, 'Account connected');
  } catch {
    return reply(503, 'Workspace connection is not configured yet');
  }
});
