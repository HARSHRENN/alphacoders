import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'npm:jose@6';

const projectId = 'alphacoders-593b1';
const keys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json',
};
const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers });
let cached: { token: string; expires: number } | null = null;

class SetupFailure extends Error {
  constructor(
    readonly stage: string,
    readonly status?: number,
    readonly reason?: string,
  ) {
    super('Firebase workspace setup failed');
  }
}
async function providerFailure(stage: string, response: Response) {
  const result = await response.json().catch(() => null);
  const allowed = new Set([
    'invalid_grant',
    'invalid_scope',
    'invalid_client',
    'unauthorized_client',
    'access_denied',
    'SERVICE_DISABLED',
    'IAM_PERMISSION_DENIED',
    'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
    'PERMISSION_DENIED',
    'INVALID_ARGUMENT',
    'INSUFFICIENT_PERMISSION',
    'PROJECT_NOT_FOUND',
    'CONFIGURATION_NOT_FOUND',
    'USER_NOT_FOUND',
    'INVALID_LOCAL_ID',
    'INVALID_PROJECT_ID',
    'INVALID_ID_TOKEN',
    'INVALID_SERVICE_ACCOUNT',
    'MISSING_IDENTIFIER',
    'OPERATION_NOT_ALLOWED',
    'UNAUTHENTICATED',
    'FAILED_PRECONDITION',
  ]);
  const messageCode =
    typeof result?.error?.message === 'string'
      ? result.error.message.match(/^[A-Z_]{3,60}(?=\s|:|$)/)?.[0]
      : undefined;
  const candidates = [
    messageCode,
    result?.error,
    result?.error?.status,
    ...(Array.isArray(result?.error?.details)
      ? result.error.details.map((d: { reason?: string }) => d.reason)
      : []),
  ];
  return new SetupFailure(
    stage,
    response.status,
    candidates.find((value) => typeof value === 'string' && allowed.has(value)) || 'provider_error',
  );
}

async function adminToken() {
  if (cached && cached.expires > Date.now() + 60000) return cached.token;
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) throw new SetupFailure('credential-missing');
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new SetupFailure('credential-json');
  }
  if (!sa || sa.project_id !== projectId || typeof sa.client_email !== 'string')
    throw new SetupFailure('credential-project');
  if (typeof sa.private_key !== 'string') throw new SetupFailure('credential-private-key');
  let assertion: string;
  // Firebase's admin lookup must identify the service account as well as carry
  // the Authentication API scope (the official Admin SDK requests both).
  try {
    assertion = await new SignJWT({
      scope:
        'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/userinfo.email',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(sa.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(await importPKCS8(sa.private_key, 'RS256'));
  } catch {
    throw new SetupFailure('credential-signing');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw await providerFailure('google-oauth', response);
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
  let subject: string;
  let authTime: number;
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      requiredClaims: ['sub', 'iat', 'exp', 'auth_time'],
    });
    if (
      !payload.sub ||
      payload.sub.length > 128 ||
      payload.email_verified !== true ||
      typeof payload.iat !== 'number' ||
      payload.iat > Date.now() / 1000 ||
      typeof payload.auth_time !== 'number' ||
      payload.auth_time > Date.now() / 1000
    )
      return reply(403, 'Verify your email first');
    subject = payload.sub;
    authTime = payload.auth_time;
  } catch {
    return reply(401, 'Invalid sign-in token');
  }
  try {
    const authorization = `Bearer ${await adminToken()}`;
    const lookup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
      {
        method: 'POST',
        headers: { authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: [subject] }),
      },
    );
    if (!lookup.ok) throw await providerFailure('account-lookup', lookup);
    const user = (await lookup.json()).users?.[0];
    if (
      !user ||
      user.localId !== subject ||
      user.disabled ||
      !user.emailVerified ||
      Number(user.validSince || 0) > authTime
    )
      return reply(403, 'Account is not authorized');
    const claims = JSON.parse(user.customAttributes || '{}');
    if (claims.role !== 'authenticated') {
      const update = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
        {
          method: 'POST',
          headers: { authorization, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            localId: subject,
            customAttributes: JSON.stringify({ ...claims, role: 'authenticated' }),
          }),
        },
      );
      if (!update.ok) throw await providerFailure('account-claims', update);
    }
    return reply(200, 'Account connected');
  } catch (error) {
    // Never log provider bodies, credentials, JWTs, user IDs, or raw exceptions.
    console.error(
      'Firebase workspace setup failed',
      error instanceof SetupFailure
        ? { stage: error.stage, status: error.status, reason: error.reason }
        : { stage: 'unexpected' },
    );
    return reply(503, 'Workspace connection is not configured yet');
  }
});
