import assert from 'node:assert/strict';
import { exportJWK, exportPKCS8, generateKeyPair, jwtVerify, SignJWT } from 'npm:jose@6';

Deno.test(
  'Firebase access verifies identity, uses admin scopes, checks revocation, and redacts failures',
  async (t) => {
    const project = 'alphacoders-593b1';
    const uid = 'verified-test-user';
    const now = Math.floor(Date.now() / 1000);
    const pair = await generateKeyPair('RS256', { extractable: true });
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
    const privateKey = await exportPKCS8(pair.privateKey);
    const serviceEmail = `test-backend@${project}.iam.gserviceaccount.com`;
    const previousSecret = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    const previousFetch = globalThis.fetch;
    const previousError = console.error;
    const previousServe = Object.getOwnPropertyDescriptor(Deno, 'serve')!;
    let handler: (request: Request) => Promise<Response>;
    let scopesChecked = false;
    let lookupDenied = false;
    const lookups: string[][] = [];
    const updates: Record<string, unknown>[] = [];
    const diagnostics: string[] = [];
    const user = {
      localId: uid,
      emailVerified: true,
      disabled: false,
      validSince: String(now - 120),
      customAttributes: JSON.stringify({ appPreference: 'dark' }),
    };
    const json = (body: unknown, status = 200) => Response.json(body, { status });
    async function token(overrides: Record<string, unknown> = {}, audience = project) {
      return await new SignJWT({ email_verified: true, auth_time: now - 60, ...overrides })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(`https://securetoken.google.com/${audience}`)
        .setAudience(audience)
        .setSubject(uid)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(pair.privateKey);
    }
    function request(idToken?: string, body?: unknown) {
      return new Request('https://test.invalid/firebase-access', {
        method: 'POST',
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    }
    try {
      Deno.env.set(
        'FIREBASE_SERVICE_ACCOUNT',
        JSON.stringify({
          project_id: project,
          client_email: serviceEmail,
          private_key: privateKey,
        }),
      );
      Object.defineProperty(Deno, 'serve', {
        configurable: true,
        enumerable: previousServe.enumerable,
        writable: true,
        value: (callback: typeof handler) => {
          handler = callback;
        },
      });
      console.error = (...values: unknown[]) => {
        diagnostics.push(JSON.stringify(values));
      };
      globalThis.fetch = async (input, init) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.includes('/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
          return json({ keys: [jwk] });
        if (url === 'https://oauth2.googleapis.com/token') {
          const form = new URLSearchParams(String(init?.body));
          const { payload } = await jwtVerify(form.get('assertion')!, pair.publicKey, {
            issuer: serviceEmail,
            audience: 'https://oauth2.googleapis.com/token',
          });
          const scopes = String(payload.scope).split(' ');
          scopesChecked =
            scopes.includes('https://www.googleapis.com/auth/identitytoolkit') &&
            scopes.includes('https://www.googleapis.com/auth/userinfo.email');
          assert.equal(scopesChecked, true, 'Admin access must identify the service account');
          return json({ access_token: 'test-only-access-token', expires_in: 3600 });
        }
        if (
          url === `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`
        ) {
          lookups.push(JSON.parse(String(init?.body)).localId);
          if (lookupDenied)
            return json(
              { error: { message: 'INSUFFICIENT_PERMISSION : private-provider-fixture' } },
              400,
            );
          return json({ users: [user] });
        }
        if (
          url === `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`
        ) {
          updates.push(JSON.parse(String(init?.body)));
          return json({ localId: uid });
        }
        throw new Error('Unexpected outbound request in isolated test');
      };
      await import('./index.ts');

      await t.step('wrong methods, missing tokens and forged tokens are rejected', async () => {
        assert.equal(
          (await handler(new Request('https://test.invalid', { method: 'GET' }))).status,
          405,
        );
        assert.equal(
          (await handler(new Request('https://test.invalid', { method: 'OPTIONS' }))).status,
          204,
        );
        assert.equal((await handler(request())).status, 401);
        assert.equal((await handler(request('forged-token'))).status, 401);
        assert.equal(lookups.length, 0);
      });
      await t.step(
        'unverified and wrong-project identities cannot reach admin lookup',
        async () => {
          assert.equal(
            (await handler(request(await token({ email_verified: false })))).status,
            403,
          );
          assert.equal((await handler(request(await token({}, 'another-project')))).status, 401);
          assert.equal(lookups.length, 0);
        },
      );
      await t.step(
        'a verified caller can connect only their own identity and authenticated claim',
        async () => {
          const response = await handler(
            request(await token(), { uid: 'someone-else', role: 'founder' }),
          );
          assert.equal(response.status, 200);
          assert.equal(scopesChecked, true);
          assert.deepEqual(lookups, [[uid]]);
          assert.equal(updates.length, 1);
          assert.equal(updates[0].localId, uid);
          assert.deepEqual(JSON.parse(String(updates[0].customAttributes)), {
            appPreference: 'dark',
            role: 'authenticated',
          });
        },
      );
      await t.step(
        'disabled accounts and sessions revoked after sign-in stay blocked',
        async () => {
          user.disabled = true;
          assert.equal((await handler(request(await token()))).status, 403);
          user.disabled = false;
          user.validSince = String(now - 30);
          // iat is newer than validSince, but auth_time is older: refreshing must not bypass revocation.
          assert.equal((await handler(request(await token()))).status, 403);
          assert.equal(updates.length, 1);
          user.validSince = String(now - 120);
        },
      );
      await t.step(
        'provider failures remain actionable without exposing secrets or tokens',
        async () => {
          lookupDenied = true;
          const idToken = await token();
          const response = await handler(request(idToken));
          assert.equal(response.status, 503);
          assert.equal(
            diagnostics.some(
              (line) => line.includes('account-lookup') && line.includes('INSUFFICIENT_PERMISSION'),
            ),
            true,
          );
          const output = diagnostics.join('\n') + (await response.text());
          for (const secret of [
            privateKey,
            idToken,
            'test-only-access-token',
            'private-provider-fixture',
          ])
            assert.equal(
              output.includes(secret),
              false,
              'Diagnostics must redact credentials and provider bodies',
            );
        },
      );
    } finally {
      globalThis.fetch = previousFetch;
      console.error = previousError;
      Object.defineProperty(Deno, 'serve', previousServe);
      if (previousSecret === undefined) Deno.env.delete('FIREBASE_SERVICE_ACCOUNT');
      else Deno.env.set('FIREBASE_SERVICE_ACCOUNT', previousSecret);
    }
  },
);
