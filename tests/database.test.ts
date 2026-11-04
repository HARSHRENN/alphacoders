import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('Postgres migration, tenant isolation, role enforcement, revision integrity, and reminders', async (t) => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const a = '00000000-0000-4000-8000-000000000001',
    b = '00000000-0000-4000-8000-000000000002',
    c = '00000000-0000-4000-8000-000000000003';
  await db.exec(
    `create schema auth; create schema extensions; create role anon; create role authenticated; create role service_role bypassrls; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/202611040001_pulse.sql', import.meta.url),
      'utf8',
    ),
  );
  await db.query('insert into auth.users(id) values ($1),($2),($3)', [a, b, c]);
  async function as(id: string, sql: string, params: any[] = []) {
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec('reset role');
    }
  }
  const org = (await as(a, "select public.create_workspace('Alex Founder','Test Studio') as id"))
    .rows[0].id;
  const code = (await as(a, 'select invite_code from public.workspaces')).rows[0].invite_code;
  await as(b, "select public.join_workspace('Maya Member',$1)", [code]);
  const other = (
    await as(c, "select public.create_workspace('Other Founder','Other Studio') as id")
  ).rows[0].id;
  const project = (
    await as(
      a,
      "insert into public.projects(org_id,name,deadline) values($1,'Android launch',now()+interval '1 day') returning id",
      [org],
    )
  ).rows[0].id;
  await t.test('a member can see only their organization', async () => {
    assert.equal((await as(b, 'select count(*)::int n from public.profiles')).rows[0].n, 2);
    assert.equal((await as(c, 'select count(*)::int n from public.projects')).rows[0].n, 0);
  });
  await t.test('members cannot create projects or change their role', async () => {
    await assert.rejects(
      as(b, "insert into public.projects(org_id,name,deadline) values($1,'Forbidden',now())", [
        org,
      ]),
      /row-level security/,
    );
    await assert.rejects(
      as(b, "update public.profiles set role='founder' where id=$1", [b]),
      /permission denied/,
    );
    await assert.rejects(as(b, 'select public.promote_founder($1)', [b]), /Only founders/);
    await assert.rejects(as(b, 'select public.enqueue_reminders()'), /permission denied/);
  });
  let update: string;
  await t.test('members post as themselves and only revise their own updates', async () => {
    await as(a, 'update public.profiles set notifications_enabled=true where id=$1', [a]);
    update = (
      await as(
        b,
        "insert into public.work_updates(org_id,project_id,user_id,completed,remaining,progress,eta,period_hours) values($1,$2,$3,'Built UI','QA',75,now()+interval '1 day',1) returning id",
        [org, project, b],
      )
    ).rows[0].id;
    await assert.rejects(
      as(
        b,
        "insert into public.work_updates(org_id,project_id,user_id,completed,remaining,progress,eta,period_hours) values($1,$2,$3,'Impersonated','QA',75,now()+interval '1 day',1)",
        [org, project, a],
      ),
      /row-level security/,
    );
    await assert.rejects(
      as(
        a,
        "insert into public.work_updates(org_id,project_id,user_id,completed,remaining,progress,eta,period_hours,supersedes) values($1,$2,$3,'Wrong revision','QA',80,now()+interval '1 day',1,$4)",
        [org, project, a, update],
      ),
      /only revise your own/,
    );
    await as(
      b,
      "insert into public.work_updates(org_id,project_id,user_id,completed,remaining,progress,eta,period_hours,supersedes) values($1,$2,$3,'Built UI and tests','QA',80,now()+interval '1 day',1,$4)",
      [org, project, b, update],
    );
    assert.equal((await as(b, 'select count(*)::int n from public.work_updates')).rows[0].n, 2);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.notification_jobs where event_key like 'update:%'",
        )
      ).rows[0].n,
      2,
    );
    await assert.rejects(
      as(b, "update public.work_updates set completed='Overwrite'"),
      /permission denied/,
    );
  });
  await t.test('five-minute warnings deduplicate and include all opted-in members', async () => {
    await db.exec('delete from public.notification_jobs');
    await db.query(
      "update public.profiles set notifications_enabled=true,reminder_anchor=date_trunc('minute',now())-interval '55 minutes' where org_id=$1",
      [org],
    );
    await db.query(
      "update public.projects set deadline=date_trunc('minute',now())+interval '5 minutes' where id=$1",
      [project],
    );
    await db.exec('select public.enqueue_reminders(); select public.enqueue_reminders();');
    assert.equal(
      (await db.query('select count(*)::int n from public.notification_jobs')).rows[0].n,
      4,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.notification_jobs where event_key like 'deadline:%'",
        )
      ).rows[0].n,
      2,
    );
    const first = await db.query('select * from public.claim_notification_jobs()');
    assert.equal(first.rows.length, 4);
    assert.equal((await db.query('select * from public.claim_notification_jobs()')).rows.length, 0);
  });
  await t.test(
    'due reminders fire at the interval and archived projects reject updates',
    async () => {
      await db.exec('delete from public.notification_jobs');
      await db.query(
        "update public.profiles set reminder_anchor=date_trunc('minute',now())-interval '1 hour' where org_id=$1",
        [org],
      );
      await db.exec('select public.enqueue_reminders()');
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.notification_jobs where event_key like 'checkin:%' and title='Time for a work update'",
          )
        ).rows[0].n,
        2,
      );
      await as(a, 'update public.projects set archived=true where id=$1', [project]);
      await assert.rejects(
        as(
          b,
          "insert into public.work_updates(org_id,project_id,user_id,completed,remaining,progress,eta,period_hours) values($1,$2,$3,'Archived update','QA',80,now()+interval '1 day',1)",
          [org, project, b],
        ),
        /row-level security/,
      );
    },
  );
  await t.test('founder promotion cannot cross workspace boundaries', async () => {
    await assert.rejects(as(a, 'select public.promote_founder($1)', [c]), /not found/);
    await as(a, 'select public.promote_founder($1)', [b]);
    assert.equal(
      (await as(b, 'select role from public.profiles where id=$1', [b])).rows[0].role,
      'founder',
    );
  });
  await db.close();
});
