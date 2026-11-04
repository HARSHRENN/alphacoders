-- Run after deploying the notify function. Replace placeholders before execution.
-- Store CRON_SECRET with `supabase secrets set CRON_SECRET=...` using the SAME value.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret('https://YOUR_PROJECT.supabase.co/functions/v1/notify', 'pulse_notify_url');
select vault.create_secret('YOUR_RANDOM_32_BYTE_CRON_SECRET', 'pulse_cron_secret');
select cron.schedule('pulse-notifications', '* * * * *', $$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='pulse_notify_url'),
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='pulse_cron_secret')),
  body := '{}'::jsonb
 );
$$);
