-- Work time is written only through server-timestamped, self-only RPCs.
begin;
create table if not exists public.work_sessions (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.workspaces(id),
 user_id uuid not null references public.profiles(id),
 started_at timestamptz not null default clock_timestamp(),
 ended_at timestamptz,
 constraint work_session_time_order check(ended_at is null or ended_at >= started_at)
);
create unique index if not exists work_sessions_one_open on public.work_sessions(user_id) where ended_at is null;
create index if not exists work_sessions_org_start on public.work_sessions(org_id,started_at,id);
create index if not exists work_sessions_user_start on public.work_sessions(user_id,started_at);
alter table public.work_sessions enable row level security;
drop policy if exists work_sessions_read on public.work_sessions;
create policy work_sessions_read on public.work_sessions for select to authenticated
 using(org_id=public.my_org() and (user_id=public.current_user_id() or public.is_founder()));
revoke all on public.work_sessions from public,anon,authenticated;
grant select on public.work_sessions to authenticated;
grant all on public.work_sessions to service_role;

create or replace function public.start_work() returns public.work_sessions
 language plpgsql security definer set search_path='' as $$
declare person uuid:=public.current_user_id(); org uuid; work public.work_sessions;
begin
 -- The profile lock serializes start/stop requests from multiple devices.
 select org_id into org from public.profiles where id=person for update;
 if org is null then raise exception 'Join a workspace before starting work'; end if;
 select * into work from public.work_sessions where user_id=person and ended_at is null;
 if found then return work; end if;
 insert into public.work_sessions(org_id,user_id,started_at)
 values(org,person,clock_timestamp()) returning * into work;
 return work;
end $$;

create or replace function public.stop_work(session_id uuid default null) returns public.work_sessions
 language plpgsql security definer set search_path='' as $$
declare person uuid:=public.current_user_id(); org uuid; work public.work_sessions;
begin
 select org_id into org from public.profiles where id=person for update;
 if org is null then raise exception 'Join a workspace before stopping work'; end if;
 -- A retry for an old session must never stop a newer session.
 update public.work_sessions
 set ended_at=greatest(clock_timestamp(),started_at)
 where user_id=person and org_id=org and ended_at is null
 and (session_id is null or id=session_id) returning * into work;
 if found then return work; end if;
 if session_id is not null then
  select * into work from public.work_sessions where id=session_id and user_id=person and org_id=org;
 end if;
 return work;
end $$;
revoke all on function public.start_work(),public.stop_work(uuid) from public,anon;
grant execute on function public.start_work(),public.stop_work(uuid) to authenticated;

-- Polling also refreshes time records; Realtime makes other devices update sooner.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='work_sessions') then
  alter publication supabase_realtime add table public.work_sessions;
 end if;
end $$;
commit;
