-- Founders supervise work. Only team members run work clocks and receive check-in prompts.
begin;
lock table public.profiles in share row exclusive mode;
create or replace function public.start_work() returns public.work_sessions
 language plpgsql security definer set search_path='' as $$
declare person uuid:=public.current_user_id(); org uuid; member_role text; work public.work_sessions;
begin
 -- The profile lock serializes start/stop requests from multiple devices.
 select org_id,role into org,member_role from public.profiles where id=person for update;
 if org is null then raise exception 'Join a workspace before starting work'; end if;
 if member_role <> 'member' then raise exception 'Work timers are for team members only'; end if;
 select * into work from public.work_sessions where user_id=person and ended_at is null;
 if found then return work; end if;
 insert into public.work_sessions(org_id,user_id,started_at)
 values(org,person,clock_timestamp()) returning * into work;
 return work;
end $$;


-- Preserve existing history, but finish any timer opened by a founder in the old app.
update public.work_sessions work set ended_at=greatest(clock_timestamp(),work.started_at)
from public.profiles person where work.user_id=person.id and person.role='founder' and work.ended_at is null;
update public.notification_jobs job set status='failed'
from public.profiles person where job.user_id=person.id and person.role='founder' and job.event_key like 'checkin:%' and job.status='pending';

create or replace function public.finish_work_on_founder_promotion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.role='founder' and old.role is distinct from new.role then
  update public.work_sessions set ended_at=greatest(clock_timestamp(),started_at) where user_id=new.id and ended_at is null;
  update public.notification_jobs set status='failed' where user_id=new.id and event_key like 'checkin:%' and status='pending';
 end if;
 return new;
end $$;
revoke all on function public.finish_work_on_founder_promotion() from public,anon,authenticated;
drop trigger if exists finish_work_on_founder_promotion on public.profiles;
create trigger finish_work_on_founder_promotion after update of role on public.profiles for each row execute function public.finish_work_on_founder_promotion();

create or replace function public.enqueue_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_jobs(user_id,event_key,title,body,data)
 select p.id,'checkin:'||extract(epoch from slot.due)::bigint||':'||kind.early,
 case when kind.early then 'Your check-in is due in 5 minutes' else 'Time for a work update' end,
 'Share what is completed, what remains, and when you will finish.',jsonb_build_object('screen','updates')
 from public.profiles p
 cross join lateral (select greatest(1,floor(extract(epoch from (now()-p.reminder_anchor))/(p.cadence*3600)))::int n) cycle
 cross join lateral (values(p.reminder_anchor+make_interval(hours=>p.cadence*cycle.n)),(p.reminder_anchor+make_interval(hours=>p.cadence*(cycle.n+1)))) slot(due)
 cross join (values(true),(false)) kind(early)
 where p.role='member' and p.notifications_enabled and slot.due-case when kind.early then interval '5 minutes' else interval '0' end between now()-interval '4 minutes' and now()
 on conflict(user_id,event_key) do nothing;
 insert into public.notification_jobs(user_id,event_key,title,body,data)
 select p.id,'deadline:'||j.id||':'||extract(epoch from j.deadline)::bigint,j.name||': deadline in 5 minutes',case when p.role='founder' then 'Review your team’s latest progress and remaining work.' else 'Post your latest progress and remaining work.' end,jsonb_build_object('screen','updates','projectId',j.id)
 from public.projects j join public.profiles p on p.org_id=j.org_id
 where p.notifications_enabled and not j.archived and j.deadline-interval '5 minutes' between now()-interval '4 minutes' and now()
 on conflict(user_id,event_key) do nothing;
end $$;

revoke all on function public.start_work() from public,anon;
grant execute on function public.start_work() to authenticated;
revoke all on function public.enqueue_reminders() from public,anon,authenticated;
grant execute on function public.enqueue_reminders() to service_role;
commit;
