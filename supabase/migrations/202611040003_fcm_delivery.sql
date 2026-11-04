-- Existing Expo registrations keep working; new Android installs use FCM.
alter table public.push_tokens add column provider text not null default 'expo' check(provider in ('expo','fcm'));
alter table public.push_tokens drop constraint push_tokens_token_check;
alter table public.push_tokens add constraint push_tokens_token_check check(
 (provider='expo' and (token like 'ExponentPushToken[%]' or token like 'ExpoPushToken[%]'))
 or (provider='fcm' and length(token) between 20 and 4096 and token !~ '[[:space:]]')
);

-- Private one-use tickets authenticate cron without another shared password.
create table public.notification_runs (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(), used_at timestamptz
);
alter table public.notification_runs enable row level security;
revoke all on public.notification_runs from public,anon,authenticated;
grant all on public.notification_runs to service_role;
create function public.consume_notification_run(run_id uuid) returns boolean
language sql security definer set search_path='' as $$
 with consumed as (
  update public.notification_runs set used_at=now()
  where id=run_id and used_at is null and created_at>now()-interval '5 minutes'
  returning id
 ) select exists(select 1 from consumed)
$$;
revoke all on function public.consume_notification_run(uuid) from public,anon,authenticated;
grant execute on function public.consume_notification_run(uuid) to service_role;
