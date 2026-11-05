import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('server work clocks preserve timestamps and enforce self/founder access', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create schema auth; create schema extensions; create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.jwt(),auth.uid() to authenticated,anon;`);
  for (const name of [
    '202611040001_pulse.sql',
    '202611040002_firebase_auth.sql',
    '202611050001_work_sessions.sql',
  ]) {
    await db.exec(
      await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'),
    );
  }
  // The dashboard migration can safely be retried after a disconnected browser.
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/202611050001_work_sessions.sql', import.meta.url),
      'utf8',
    ),
  );
  const claims = (sub: string) => ({
    sub,
    iss: 'https://securetoken.google.com/alphacoders-593b1',
    aud: 'alphacoders-593b1',
    email_verified: true,
    role: 'authenticated',
  });
  const founder = claims('timeFounder'),
    member = claims('timeMember'),
    colleague = claims('timeColleague'),
    outsider = claims('timeOutside');
  async function as(claim: object, sql: string, params: unknown[] = [], role = 'authenticated') {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(claim)]);
    await db.exec(`set role ${role}`);
    try {
      return await db.query<any>(sql, params);
    } finally {
      await db.exec('reset role');
    }
  }
  await t.test(
    'unverified users, outsiders without membership and anonymous calls cannot clock in',
    async () => {
      for (const identity of [
        {},
        { ...member, email_verified: false },
        { ...member, aud: 'other-project' },
        member,
      ]) {
        await assert.rejects(as(identity, 'select * from public.start_work()'), /Join a workspace/);
      }
      await assert.rejects(
        as({}, 'select * from public.start_work()', [], 'anon'),
        /permission denied/,
      );
    },
  );
  const org = (await as(founder, "select public.create_workspace('Founder','Clock test') id"))
    .rows[0].id;
  const invite = (await as(founder, 'select invite_code from public.workspaces')).rows[0]
    .invite_code;
  await as(member, "select public.join_workspace('Member',$1)", [invite]);
  await as(colleague, "select public.join_workspace('Colleague',$1)", [invite]);
  await as(outsider, "select public.create_workspace('Outside','Other team')");
  const memberId = (await as(member, 'select public.current_user_id() id')).rows[0].id;
  let session: any;
  await t.test('repeated starts return the same server-created running session', async () => {
    const before = Date.now();
    session = (await as(member, 'select * from public.start_work()')).rows[0];
    assert.equal(session.user_id, memberId);
    assert.equal(session.org_id, org);
    assert.equal(session.ended_at, null);
    assert.ok(new Date(session.started_at).getTime() >= before - 1000);
    const retry = (await as(member, 'select * from public.start_work()')).rows[0];
    assert.equal(retry.id, session.id);
    assert.equal(
      new Date(retry.started_at).toISOString(),
      new Date(session.started_at).toISOString(),
    );
    assert.equal(
      (await as(member, 'select count(*)::int n from public.work_sessions')).rows[0].n,
      1,
    );
  });
  await t.test('members see only their own time; founders see only their workspace', async () => {
    await as(colleague, 'select * from public.start_work()');
    assert.equal(
      (await as(member, 'select count(*)::int n from public.work_sessions')).rows[0].n,
      1,
    );
    assert.equal(
      (await as(founder, 'select count(*)::int n from public.work_sessions')).rows[0].n,
      2,
    );
    assert.equal(
      (await as(outsider, 'select count(*)::int n from public.work_sessions')).rows[0].n,
      0,
    );
    assert.equal(
      (
        await as(
          { ...member, email_verified: false },
          'select count(*)::int n from public.work_sessions',
        )
      ).rows[0].n,
      0,
    );
  });
  await t.test(
    'clients cannot forge starts, edit records, delete history, or stop another person',
    async () => {
      for (const identity of [member, founder]) {
        await assert.rejects(
          as(identity, 'insert into public.work_sessions(org_id,user_id) values($1,$2)', [
            org,
            memberId,
          ]),
          /permission denied/,
        );
        await assert.rejects(
          as(identity, 'update public.work_sessions set ended_at=now() where id=$1', [session.id]),
          /permission denied/,
        );
        await assert.rejects(
          as(identity, 'delete from public.work_sessions where id=$1', [session.id]),
          /permission denied/,
        );
      }
      const foreignStop = (await as(founder, 'select * from public.stop_work($1)', [session.id]))
        .rows[0];
      assert.equal(foreignStop.id, null);
      assert.equal(
        (await as(member, 'select ended_at from public.work_sessions where id=$1', [session.id]))
          .rows[0].ended_at,
        null,
      );
      await assert.rejects(
        as(member, 'select * from public.start_work($1)', [memberId]),
        /does not exist/,
      );
    },
  );
  await t.test(
    'stops are permanent and retrying an old stop cannot close a newer session',
    async () => {
      const stopped = (await as(member, 'select * from public.stop_work($1)', [session.id]))
        .rows[0];
      assert.ok(new Date(stopped.ended_at).getTime() >= new Date(stopped.started_at).getTime());
      const next = (await as(member, 'select * from public.start_work()')).rows[0];
      assert.notEqual(next.id, session.id);
      const retried = (await as(member, 'select * from public.stop_work($1)', [session.id]))
        .rows[0];
      assert.equal(
        new Date(retried.ended_at).toISOString(),
        new Date(stopped.ended_at).toISOString(),
      );
      assert.equal(
        (await as(member, 'select id from public.work_sessions where ended_at is null')).rows[0].id,
        next.id,
      );
      // Sign-out uses the no-argument form, also covering clocks started on another device.
      await as(member, 'select * from public.stop_work()');
      assert.equal(
        (
          await as(
            member,
            'select count(*)::int n from public.work_sessions where ended_at is null',
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await as(member, 'select count(*)::int n from public.work_sessions')).rows[0].n,
        2,
      );
    },
  );
  await db.close();
});
