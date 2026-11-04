import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('Firebase identities enforce verification, project trust, membership and roles', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create schema auth; create schema extensions; create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.jwt(),auth.uid() to authenticated,anon;`);
  for (const migration of [
    '202611040001_pulse.sql',
    '202611040002_firebase_auth.sql',
    '202611040003_fcm_delivery.sql',
  ]) {
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'),
    );
  }
  const claims = (uid: string) => ({
    sub: uid,
    iss: 'https://securetoken.google.com/alphacoders-593b1',
    aud: 'alphacoders-593b1',
    role: 'authenticated',
    email_verified: true,
  });
  async function as(claim: object, sql: string, params: any[] = [], role = 'authenticated') {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claim)]);
    await db.exec(`set role ${role}`);
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec('reset role');
    }
  }
  const founder = claims('firebaseFounder_abc123'),
    member = claims('firebaseMember_xyz789'),
    outsider = claims('separateWorkspace_user');
  await t.test('anonymous, unverified and wrong-project identities cannot onboard', async () => {
    for (const claim of [
      {},
      { ...founder, email_verified: false },
      { ...founder, aud: 'other-project' },
      { ...founder, iss: 'https://securetoken.google.com/other-project' },
      { ...founder, role: 'anon' },
    ]) {
      await assert.rejects(
        as(claim, "select public.create_workspace('Blocked','Blocked')"),
        /verify your email/,
      );
    }
    await assert.rejects(
      as({}, 'select * from public.workspaces', [], 'anon'),
      /permission denied/,
    );
    await assert.rejects(as(founder, 'select * from public.user_identities'), /permission denied/);
  });
  const org = (await as(founder, "select public.create_workspace('Founder','Alphacoders') id"))
    .rows[0].id;
  const founderId = (await as(founder, 'select public.current_user_id() id')).rows[0].id;
  const code = (await as(founder, 'select invite_code from public.workspaces')).rows[0].invite_code;
  await as(member, "select public.join_workspace('Member',$1)", [code]);
  const memberId = (await as(member, 'select public.current_user_id() id')).rows[0].id;
  await as(outsider, "select public.create_workspace('Outside','Separate')");
  await t.test('Firebase string UIDs map to stable private UUIDs', async () => {
    assert.match(String(founderId), /^[0-9a-f-]{36}$/);
    assert.equal((await as(founder, 'select public.register_identity() id')).rows[0].id, founderId);
    await assert.rejects(
      as(member, "insert into public.user_identities(firebase_uid) values('victim')"),
      /permission denied/,
    );
    assert.equal((await as(member, 'select count(*)::int n from public.profiles')).rows[0].n, 2);
    await assert.rejects(
      as(member, "select public.create_workspace('Member','Duplicate')"),
      /already belong/,
    );
  });
  const project = (
    await as(
      founder,
      "insert into public.projects(org_id,name,deadline) values($1,'Real project',now()+interval '1 day') returning id",
      [org],
    )
  ).rows[0].id;
  await t.test('members cannot impersonate founders or read other workspaces', async () => {
    assert.equal((await as(outsider, 'select count(*)::int n from public.projects')).rows[0].n, 0);
    await assert.rejects(
      as(
        member,
        "insert into public.projects(org_id,name,deadline) values($1,'Forbidden',now()+interval '1 day')",
        [org],
      ),
      /row-level security/,
    );
    await assert.rejects(
      as(member, "update public.profiles set role='founder'"),
      /permission denied/,
    );
    await assert.rejects(
      as(member, 'select public.promote_founder($1)', [memberId]),
      /Only founders/,
    );
    await assert.rejects(
      as(
        member,
        "insert into public.work_updates(org_id,project_id,user_id,completed,remaining,progress,eta,period_hours) values($1,$2,$3,'Impersonation','QA',50,now()+interval '1 day',1)",
        [org, project, founderId],
      ),
      /row-level security/,
    );
  });
  await t.test('verified members can post and revisions still notify founders', async () => {
    await as(founder, 'update public.profiles set notifications_enabled=true where id=$1', [
      founderId,
    ]);
    const update = (
      await as(
        member,
        "insert into public.work_updates(org_id,project_id,user_id,completed,remaining,progress,eta,period_hours) values($1,$2,$3,'Done','QA',80,now()+interval '1 day',1) returning id",
        [org, project, memberId],
      )
    ).rows[0].id;
    await as(
      member,
      "insert into public.work_updates(org_id,project_id,user_id,completed,remaining,progress,eta,period_hours,supersedes) values($1,$2,$3,'Revised','QA',90,now()+interval '1 day',1,$4)",
      [org, project, memberId, update],
    );
    assert.equal(
      (await db.query('select count(*)::int n from public.notification_jobs')).rows[0].n,
      2,
    );
    assert.equal(
      (await as(member, 'select count(*)::int n from public.work_updates')).rows[0].n,
      2,
    );
    await as(founder, 'select public.promote_founder($1)', [memberId]);
    assert.equal((await as(member, 'select public.is_founder() ok')).rows[0].ok, true);
  });
  await t.test('expired verification or a different issuer loses existing access', async () => {
    assert.equal(
      (
        await as(
          { ...member, email_verified: false },
          'select count(*)::int n from public.work_updates',
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await as({ ...member, aud: 'other-project' }, 'select count(*)::int n from public.profiles'))
        .rows[0].n,
      0,
    );
  });
  await t.test('FCM registration is self-only and legacy Expo tokens remain valid', async () => {
    await as(member, "insert into public.push_tokens(token,user_id,provider) values($1,$2,'fcm')", [
      'nativeFCMToken_1234567890:abc',
      memberId,
    ]);
    await as(member, 'insert into public.push_tokens(token,user_id) values($1,$2)', [
      'ExpoPushToken[legacy-device]',
      memberId,
    ]);
    assert.equal((await as(member, 'select count(*)::int n from public.push_tokens')).rows[0].n, 2);
    await assert.rejects(
      as(founder, "insert into public.push_tokens(token,user_id,provider) values($1,$2,'fcm')", [
        'anotherFCMToken_1234567890:abc',
        memberId,
      ]),
      /row-level security/,
    );
    await assert.rejects(
      as(
        member,
        "insert into public.push_tokens(token,user_id,provider) values('short',$1,'fcm')",
        [memberId],
      ),
      /check constraint/,
    );
  });
  await t.test('cron tickets are private, expire, and can be consumed only once', async () => {
    const ticket = (
      await db.query('insert into public.notification_runs default values returning id')
    ).rows[0].id;
    await assert.rejects(as(member, 'select * from public.notification_runs'), /permission denied/);
    await assert.rejects(
      as(member, 'select public.consume_notification_run($1)', [ticket]),
      /permission denied/,
    );
    assert.equal(
      (await as({}, 'select public.consume_notification_run($1) ok', [ticket], 'service_role'))
        .rows[0].ok,
      true,
    );
    assert.equal(
      (await as({}, 'select public.consume_notification_run($1) ok', [ticket], 'service_role'))
        .rows[0].ok,
      false,
    );
    const expired = (
      await db.query(
        "insert into public.notification_runs(created_at) values(now()-interval '6 minutes') returning id",
      )
    ).rows[0].id;
    assert.equal(
      (await as({}, 'select public.consume_notification_run($1) ok', [expired], 'service_role'))
        .rows[0].ok,
      false,
    );
  });
  await db.close();
});
