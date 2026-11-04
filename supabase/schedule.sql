-- Apply after all migrations and deploying notify with verify_jwt=false.
-- One-use invocation tickets authenticate cron without an extra shared secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create or replace function public.dispatch_notifications() returns bigint
language plpgsql security definer set search_path='' as $$
declare ticket uuid; request_id bigint;
begin
 delete from public.notification_runs where created_at<now()-interval '10 minutes';
 insert into public.notification_runs default values returning id into ticket;
 select net.http_post(
  url:='https://jrvqllgpuhzwyswwmpka.supabase.co/functions/v1/notify',
  headers:='{"Content-Type":"application/json"}'::jsonb,
  body:=jsonb_build_object('run_id',ticket), timeout_milliseconds:=10000
 ) into request_id;
 return request_id;
end $$;
revoke all on function public.dispatch_notifications() from public,anon,authenticated;
grant execute on function public.dispatch_notifications() to service_role;
select cron.schedule('pulse-notifications','* * * * *','select public.dispatch_notifications();');
