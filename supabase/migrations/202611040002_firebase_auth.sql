-- Firebase UIDs are strings. Keep all existing application UUIDs and records;
-- map the verified Firebase identity to a private internal UUID instead.
create table public.user_identities (
 id uuid primary key default gen_random_uuid(),
 firebase_uid text unique check(length(firebase_uid) between 1 and 128),
 created_at timestamptz not null default now()
);
alter table public.user_identities enable row level security;
revoke all on public.user_identities from public,anon,authenticated;
grant all on public.user_identities to service_role;
insert into public.user_identities(id) select id from auth.users on conflict do nothing;
alter table public.workspaces drop constraint workspaces_created_by_fkey;
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.workspaces add constraint workspaces_created_by_fkey foreign key(created_by) references public.user_identities(id);
alter table public.profiles add constraint profiles_id_fkey foreign key(id) references public.user_identities(id) on delete cascade;

-- Supabase's Firebase integration verifies the JWT signature, issuer, audience
-- and expiry. These checks additionally pin this app to its configured project
-- and require email verification even if a modified client bypasses the UI.
create function public.firebase_subject() returns text language sql stable set search_path='' as $$
 select case when
  auth.jwt()->>'iss'='https://securetoken.google.com/alphacoders-593b1'
  and auth.jwt()->>'aud'='alphacoders-593b1'
  and auth.jwt()->>'email_verified'='true'
  and auth.jwt()->>'role'='authenticated'
 then nullif(auth.jwt()->>'sub','') else null end
$$;
create function public.current_user_id() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.user_identities where firebase_uid=public.firebase_subject()
$$;
create function public.register_identity() returns uuid language plpgsql security definer set search_path='' as $$
declare subject text:=public.firebase_subject(); identity_id uuid;
begin
 if subject is null then raise exception 'Sign in and verify your email first'; end if;
 insert into public.user_identities(firebase_uid) values(subject)
 on conflict(firebase_uid) do update set firebase_uid=excluded.firebase_uid returning id into identity_id;
 return identity_id;
end $$;
revoke all on function public.firebase_subject(),public.current_user_id(),public.register_identity() from public,anon;
grant execute on function public.firebase_subject(),public.current_user_id(),public.register_identity() to authenticated;

create or replace function public.my_org() returns uuid language sql stable security definer set search_path='' as $$ select org_id from public.profiles where id=public.current_user_id() $$;
create or replace function public.is_founder() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select role='founder' from public.profiles where id=public.current_user_id()),false) $$;
alter policy profile_preferences on public.profiles using(id=public.current_user_id()) with check(id=public.current_user_id());
alter policy updates_create on public.work_updates with check(org_id=public.my_org() and user_id=public.current_user_id() and exists(select 1 from public.projects p where p.id=project_id and not p.archived));
alter policy token_own on public.push_tokens using(user_id=public.current_user_id()) with check(user_id=public.current_user_id());

create or replace function public.create_workspace(display_name text,workspace_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; identity_id uuid:=public.register_identity();
begin
 if exists(select 1 from public.profiles where id=identity_id) then raise exception 'You already belong to a workspace'; end if;
 insert into public.workspaces(name,created_by) values(trim(workspace_name),identity_id) returning id into org;
 insert into public.profiles(id,org_id,name,role) values(identity_id,org,trim(display_name),'founder');
 return org;
end $$;
create or replace function public.join_workspace(display_name text,code text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; identity_id uuid:=public.register_identity();
begin
 if exists(select 1 from public.profiles where id=identity_id) then raise exception 'You already belong to a workspace'; end if;
 select id into org from public.workspaces where invite_code=upper(trim(code));
 if org is null then raise exception 'This invite code is not valid. Ask your founder for the correct code.'; end if;
 insert into public.profiles(id,org_id,name,role) values(identity_id,org,trim(display_name),'member');
 return org;
end $$;
