-- =====================================================================
-- STEP 1: multi-tenant migration (organizations + roles admin/customer/demo)
-- Take a database backup first. Runs as one transaction: if anything
-- fails, nothing is changed.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Organizations
-- ---------------------------------------------------------------------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- ---------------------------------------------------------------------
-- 2. Profiles: org + role rules
--    admin = you (org_id stays null). customer/demo belong to one org.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column org_id uuid references public.organizations(id) on delete cascade;

-- an older role check already exists (it only allowed admin/customer): replace it
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin','customer','demo'));

-- NOT VALID: old rows are not checked, new/changed rows are.
alter table public.profiles
  add constraint profiles_org_required check (role = 'admin' or org_id is not null) not valid;

-- ---------------------------------------------------------------------
-- 3. Helper functions (new users with no org/role have no access)
-- ---------------------------------------------------------------------
create or replace function public.my_org() returns uuid
  language sql stable security definer set search_path = public as
$$ select org_id from public.profiles where id = auth.uid() $$;

create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

revoke all on function public.my_org(), public.my_role() from public, anon;
grant execute on function public.my_org(), public.my_role() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Wipe the old data, then add org_id to every data table.
--    THIS DELETES ALL EXISTING projects, wings, stages, flats, payments,
--    charges, installments, documents, drive items and templates.
--    (statuses and user accounts are kept.)
-- ---------------------------------------------------------------------
truncate table public.template_items, public.installment_templates,
  public.payments, public.flat_installments, public.flat_charges,
  public.documents, public.flats, public.wings, public.stages,
  public.drive_items, public.projects
  cascade;

insert into public.organizations (name, is_demo) values ('Demo', true);

do $$
declare t text;
begin
  foreach t in array array['projects','wings','stages','flats','flat_charges',
    'flat_installments','payments','documents','drive_items',
    'installment_templates','template_items'] loop
    execute format('alter table public.%I add column org_id uuid not null', t);
    execute format('alter table public.%I add constraint %I foreign key (org_id) references public.organizations(id) on delete cascade', t, t || '_org_fk');
    execute format('create index %I on public.%I (org_id)', t || '_org_idx', t);
  end loop;
end $$;

create index if not exists drive_items_storage_path_idx on public.drive_items (storage_path);
create index if not exists documents_storage_path_idx   on public.documents (storage_path);

-- ---------------------------------------------------------------------
-- 5. org_id is filled in by the database, never trusted from the browser.
--    Children copy it from their parent; top-level rows use the caller's org.
-- ---------------------------------------------------------------------
create or replace function public.set_org_id() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare v uuid;
begin
  case tg_table_name
    when 'wings', 'stages' then
      select org_id into v from public.projects where id = new.project_id;
    when 'flats' then
      select org_id into v from public.wings where id = new.wing_id;
    when 'flat_charges', 'flat_installments', 'payments', 'documents' then
      select org_id into v from public.flats where id = new.flat_id;
    when 'template_items' then
      select org_id into v from public.installment_templates where id = new.template_id;
    when 'drive_items' then
      if new.parent_id is not null then
        select org_id into v from public.drive_items where id = new.parent_id;
      elsif tg_op = 'UPDATE' then
        v := old.org_id;
      else
        v := coalesce(new.org_id, public.my_org());
      end if;
    else -- projects, installment_templates
      if tg_op = 'UPDATE' then
        v := old.org_id;
      else
        v := coalesce(new.org_id, public.my_org());
      end if;
  end case;

  if v is null then
    raise exception 'org_id could not be determined for %', tg_table_name;
  end if;
  new.org_id := v;
  return new;
end
$$;

revoke all on function public.set_org_id() from public, anon;

do $$
declare t text;
begin
  foreach t in array array['projects','wings','stages','flats','flat_charges',
    'flat_installments','payments','documents','drive_items',
    'installment_templates','template_items'] loop
    execute format('create trigger trg_set_org before insert or update on public.%I
                    for each row execute function public.set_org_id()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
--    admin: everything.  customer: read+write own org.  demo: read own org.
-- ---------------------------------------------------------------------
drop policy "admin projects"      on public.projects;
drop policy "read projects"       on public.projects;
drop policy "admin wings"         on public.wings;
drop policy "read wings"          on public.wings;
drop policy "admin stages"        on public.stages;
drop policy "admin flats"         on public.flats;
drop policy "admin charges"       on public.flat_charges;
drop policy "admin installments"  on public.flat_installments;
drop policy "admin payments"      on public.payments;
drop policy "admin documents"     on public.documents;
drop policy "drive_items admin all" on public.drive_items;
drop policy "admin templates"     on public.installment_templates;
drop policy "admin tpl items"     on public.template_items;

do $$
declare t text;
begin
  foreach t in array array['projects','wings','stages','flats','flat_charges',
    'flat_installments','payments','documents','drive_items',
    'installment_templates','template_items'] loop
    execute format($f$
      create policy "org read" on public.%I for select to authenticated
      using (public.is_admin() or org_id = (select public.my_org()))
    $f$, t);
    execute format($f$
      create policy "org write" on public.%I for all to authenticated
      using (public.is_admin()
             or (org_id = (select public.my_org()) and (select public.my_role()) = 'customer'))
      with check (public.is_admin()
             or (org_id = (select public.my_org()) and (select public.my_role()) = 'customer'))
    $f$, t);
  end loop;
end $$;

-- organizations: you manage all; everyone else sees only their own row
create policy "org self read" on public.organizations for select to authenticated
  using (public.is_admin() or id = (select public.my_org()));
create policy "org admin all" on public.organizations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- statuses stay global (read for everyone logged in, write for admin): unchanged.

-- ---------------------------------------------------------------------
-- 7. Close the view leak: run the view with the caller's rights
-- ---------------------------------------------------------------------
alter view public.flat_summary set (security_invoker = true);
revoke all on public.flat_summary from anon;

-- ---------------------------------------------------------------------
-- 8. Storage: a file is visible only if you can see its database row.
--    (Existing file paths do not change.)
-- ---------------------------------------------------------------------
drop policy "drive bucket admin all" on storage.objects;
drop policy "admin manages files"    on storage.objects;

create policy "drive read" on storage.objects for select to authenticated
  using (bucket_id = 'drive' and (public.is_admin() or exists (
    select 1 from public.drive_items di where di.storage_path = objects.name)));
create policy "drive upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'drive' and (public.is_admin() or (select public.my_role()) = 'customer'));
create policy "drive delete" on storage.objects for delete to authenticated
  using (bucket_id = 'drive' and (public.is_admin() or (
    (select public.my_role()) = 'customer' and (
      owner_id = (select auth.uid())::text
      or exists (select 1 from public.drive_items di where di.storage_path = objects.name)))));

create policy "documents read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (public.is_admin() or exists (
    select 1 from public.documents d where d.storage_path = objects.name)));
create policy "documents upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (public.is_admin() or (select public.my_role()) = 'customer'));
create policy "documents delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (public.is_admin() or (
    (select public.my_role()) = 'customer' and (
      owner_id = (select auth.uid())::text
      or exists (select 1 from public.documents d where d.storage_path = objects.name)))));

commit;

-- =====================================================================
-- AFTER RUNNING:
--
-- a) Old uploaded files are now orphans. In the Supabase dashboard go to
--    Storage and empty the "drive" and "documents" buckets.
--
-- b) Existing logins keep their role. Admins stay admin. Any old
--    'customer' accounts have no organization and see nothing; delete them
--    in Authentication > Users (real customers get created from the
--    admin Customers page we build in step 3).
-- =====================================================================