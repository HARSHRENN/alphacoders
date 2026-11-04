-- Apply once to a fresh Supabase project. Authorization is enforced in Postgres.
create extension if not exists pgcrypto with schema extensions;
create table public.workspaces (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 100),
 invite_code text not null unique default upper(encode(extensions.gen_random_bytes(12),'hex')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, org_id uuid not null references public.workspaces(id),
 name text not null check(length(trim(name)) between 2 and 100), role text not null check(role in ('founder','member')),
 avatar text not null default '#dcefe5', cadence integer not null default 1 check(cadence in (1,2)),
 notifications_enabled boolean not null default false, reminder_anchor timestamptz not null default date_trunc('minute',now())
);
create table public.projects (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.workspaces(id),
 name text not null check(length(trim(name)) between 1 and 150),description text not null default '',
 color text not null default '#6b5cce',icon text not null default 'layers-outline',deadline timestamptz not null,
 priority text not null default 'Medium' check(priority in ('High','Medium','Low')),archived boolean not null default false,created_at timestamptz not null default now(),
 unique(id,org_id)
);
create table public.work_updates (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.workspaces(id),
 project_id uuid not null,user_id uuid not null references public.profiles(id),
 completed text not null check(length(trim(completed)) between 1 and 10000),remaining text not null default '',blocker text not null default '',
 progress integer not null check(progress between 0 and 100),eta timestamptz not null,created_at timestamptz not null default now(),
 period_hours integer not null check(period_hours in (1,2)),supersedes uuid unique references public.work_updates(id),
 foreign key(project_id,org_id) references public.projects(id,org_id),
 check(progress=100 or length(trim(remaining))>0)
);
create index updates_org_time on public.work_updates(org_id,created_at desc);
create index profiles_org on public.profiles(org_id);
create index projects_org on public.projects(org_id);
create table public.push_tokens (
 token text primary key check(token like 'ExponentPushToken[%]' or token like 'ExpoPushToken[%]'),
 user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens(user_id);
create table public.notification_jobs (
 id bigint generated always as identity primary key,user_id uuid not null references public.profiles(id) on delete cascade,
 event_key text not null,title text not null,body text not null,data jsonb not null default '{}',
 status text not null default 'pending' check(status in ('pending','sent','failed')),attempts integer not null default 0,
 available_at timestamptz not null default now(),locked_until timestamptz,created_at timestamptz not null default now(),
 unique(user_id,event_key)
);
create index notification_jobs_pending on public.notification_jobs(available_at) where status='pending';
-- Security-definer helpers avoid recursive policies and never accept a caller-provided identity.
create function public.my_org() returns uuid language sql stable security definer set search_path='' as $$ select org_id from public.profiles where id=(select auth.uid()) $$;
create function public.is_founder() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select role='founder' from public.profiles where id=(select auth.uid())),false) $$;
revoke all on function public.my_org(),public.is_founder() from public;
grant execute on function public.my_org(),public.is_founder() to authenticated;

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.work_updates enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_jobs enable row level security;
create policy workspace_read on public.workspaces for select to authenticated using(id=public.my_org());
create policy profiles_read on public.profiles for select to authenticated using(org_id=public.my_org());
create policy profile_preferences on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy projects_read on public.projects for select to authenticated using(org_id=public.my_org());
create policy projects_create on public.projects for insert to authenticated with check(org_id=public.my_org() and public.is_founder());
create policy projects_change on public.projects for update to authenticated using(org_id=public.my_org() and public.is_founder()) with check(org_id=public.my_org() and public.is_founder());
create policy updates_read on public.work_updates for select to authenticated using(org_id=public.my_org());
create policy updates_create on public.work_updates for insert to authenticated with check(org_id=public.my_org() and user_id=auth.uid() and exists(select 1 from public.projects p where p.id=project_id and not p.archived));
create policy token_own on public.push_tokens for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
-- Explicit column grants prevent changing roles, membership, author, or timestamps from the client.
revoke all on public.workspaces,public.profiles,public.projects,public.work_updates,public.push_tokens,public.notification_jobs from anon,authenticated;
grant select on public.workspaces,public.profiles,public.projects,public.work_updates to authenticated;
grant update(cadence,notifications_enabled) on public.profiles to authenticated;
grant insert(org_id,name,description,color,icon,deadline,priority,archived) on public.projects to authenticated;
grant update(archived) on public.projects to authenticated;
grant insert(org_id,project_id,user_id,completed,remaining,blocker,progress,eta,period_hours,supersedes) on public.work_updates to authenticated;
grant select,insert,update,delete on public.push_tokens to authenticated;
grant all on public.workspaces,public.profiles,public.projects,public.work_updates,public.push_tokens,public.notification_jobs to service_role;
grant usage,select on sequence public.notification_jobs_id_seq to service_role;

create function public.create_workspace(display_name text,workspace_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'You already belong to a workspace'; end if;
 insert into public.workspaces(name,created_by) values(trim(workspace_name),auth.uid()) returning id into org;
 insert into public.profiles(id,org_id,name,role) values(auth.uid(),org,trim(display_name),'founder');
 return org;
end $$;
create function public.join_workspace(display_name text,code text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'You already belong to a workspace'; end if;
 select id into org from public.workspaces where invite_code=upper(trim(code));
 if org is null then raise exception 'This invite code is not valid. Ask your founder for the correct code.'; end if;
 insert into public.profiles(id,org_id,name,role) values(auth.uid(),org,trim(display_name),'member');
 return org;
end $$;
create function public.promote_founder(member_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_founder() then raise exception 'Only founders can promote members'; end if;
 update public.profiles set role='founder' where id=member_id and org_id=public.my_org();
 if not found then raise exception 'Team member not found'; end if;
end $$;
revoke all on function public.create_workspace(text,text),public.join_workspace(text,text),public.promote_founder(uuid) from public;
grant execute on function public.create_workspace(text,text),public.join_workspace(text,text),public.promote_founder(uuid) to authenticated;

create function public.validate_work_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.eta<=now() then raise exception 'Expected completion must be in the future'; end if;
 if new.supersedes is not null and not exists(select 1 from public.work_updates where id=new.supersedes and user_id=new.user_id and project_id=new.project_id and org_id=new.org_id) then raise exception 'You can only revise your own update in the same project'; end if;
 return new;
end $$;
create trigger validate_update before insert on public.work_updates for each row execute function public.validate_work_update();
create function public.notify_founders() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_jobs(user_id,event_key,title,body,data)
 select p.id,'update:'||new.id,case when new.supersedes is null then 'New team update' else 'Team update revised' end,
 author.name||' posted progress on '||project.name,jsonb_build_object('screen','updates','projectId',new.project_id,'updateId',new.id)
 from public.profiles p join public.profiles author on author.id=new.user_id join public.projects project on project.id=new.project_id
 where p.org_id=new.org_id and p.role='founder' and p.id<>new.user_id and p.notifications_enabled;
 return new;
end $$;
create trigger founder_feed after insert on public.work_updates for each row execute function public.notify_founders();

-- Called every minute by the service-role worker. Event keys deduplicate cron ticks.
create function public.enqueue_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_jobs(user_id,event_key,title,body,data)
 select p.id,'checkin:'||extract(epoch from slot.due)::bigint||':'||kind.early,
 case when kind.early then 'Your check-in is due in 5 minutes' else 'Time for a work update' end,
 'Share what is completed, what remains, and when you will finish.',jsonb_build_object('screen','updates')
 from public.profiles p
 cross join lateral (select greatest(1,floor(extract(epoch from (now()-p.reminder_anchor))/(p.cadence*3600)))::int n) cycle
 cross join lateral (values(p.reminder_anchor+make_interval(hours=>p.cadence*cycle.n)),(p.reminder_anchor+make_interval(hours=>p.cadence*(cycle.n+1)))) slot(due)
 cross join (values(true),(false)) kind(early)
 where p.notifications_enabled and slot.due-case when kind.early then interval '5 minutes' else interval '0' end between now()-interval '4 minutes' and now()
 on conflict(user_id,event_key) do nothing;
 insert into public.notification_jobs(user_id,event_key,title,body,data)
 select p.id,'deadline:'||j.id||':'||extract(epoch from j.deadline)::bigint,j.name||': deadline in 5 minutes','Post your latest progress and remaining work.',jsonb_build_object('screen','updates','projectId',j.id)
 from public.projects j join public.profiles p on p.org_id=j.org_id
 where p.notifications_enabled and not j.archived and j.deadline-interval '5 minutes' between now()-interval '4 minutes' and now()
 on conflict(user_id,event_key) do nothing;
end $$;
create function public.claim_notification_jobs() returns setof public.notification_jobs language sql security definer set search_path='' as $$
 update public.notification_jobs set locked_until=now()+interval '2 minutes',attempts=attempts+1
 where id in (select id from public.notification_jobs where status='pending' and available_at<=now() and (locked_until is null or locked_until<now()) order by id for update skip locked limit 100) returning *;
$$;
revoke all on function public.enqueue_reminders(),public.claim_notification_jobs() from public,anon,authenticated;
grant execute on function public.enqueue_reminders(),public.claim_notification_jobs() to service_role;

-- Enable live refresh when running in Supabase; tests also run in plain Postgres.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.work_updates,public.projects,public.profiles;
 end if;
end $$;
