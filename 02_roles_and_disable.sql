-- =====================================================================
-- STEP 2 (run BEFORE deploying the routes): instant disable + user creation fix
-- =====================================================================
begin;

-- 'disabled' users keep their login row but the database stops serving them.
alter table public.profiles add column if not exists disabled boolean not null default false;

create or replace function public.my_org() returns uuid
  language sql stable security definer set search_path = public as
$$ select org_id from public.profiles where id = auth.uid() and not disabled $$;

create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and not disabled $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not disabled) $$;

-- New users are created by handle_new_user as role 'customer' with no org,
-- which the step-1 constraint rejected. The route fills in role + org right
-- after creation, and a user with no org already sees nothing (my_org() is null).
alter table public.profiles drop constraint if exists profiles_org_required;

commit;
