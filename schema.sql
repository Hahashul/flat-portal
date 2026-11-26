-- Flat Portal database schema
-- Copyright (c) Harshul Adwani. All rights reserved.
-- Exported from Supabase: tables, foreign keys, indexes, functions, view,
-- triggers, RLS and storage policies, buckets.
-- Run in the Supabase SQL Editor on a new project.
-- Note: reference data (rows in public.statuses) is not included.

-- ============ TABLES ============

create table public.documents (
  id uuid default gen_random_uuid() not null,
  flat_id uuid not null,
  kind text not null,
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamp with time zone default now() not null,
  org_id uuid not null,
  constraint documents_storage_path_key UNIQUE (storage_path),
  constraint documents_pkey PRIMARY KEY (id),
  constraint documents_kind_check CHECK ((kind = ANY (ARRAY['site_plan'::text, 'agreement'::text, 'other'::text])))
);

create table public.drive_items (
  id uuid default gen_random_uuid() not null,
  parent_id uuid,
  kind text not null,
  name text not null,
  storage_path text,
  size bigint,
  mime_type text,
  created_at timestamp with time zone default now() not null,
  org_id uuid not null,
  constraint drive_items_pkey PRIMARY KEY (id),
  constraint drive_items_check CHECK (((kind = 'folder'::text) OR (storage_path IS NOT NULL))),
  constraint drive_items_kind_check CHECK ((kind = ANY (ARRAY['folder'::text, 'file'::text]))),
  constraint drive_items_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0))
);

create table public.flat_charges (
  id uuid default gen_random_uuid() not null,
  flat_id uuid not null,
  name text not null,
  amount numeric(14,2) default 0 not null,
  org_id uuid not null,
  constraint flat_charges_flat_id_name_key UNIQUE (flat_id, name),
  constraint flat_charges_pkey PRIMARY KEY (id)
);

create table public.flat_installments (
  id uuid default gen_random_uuid() not null,
  flat_id uuid not null,
  stage_id uuid not null,
  percent numeric(6,2) not null,
  org_id uuid not null,
  constraint flat_installments_flat_id_stage_id_key UNIQUE (flat_id, stage_id),
  constraint flat_installments_pkey PRIMARY KEY (id),
  constraint flat_installments_percent_check CHECK ((percent > (0)::numeric))
);

create table public.flats (
  id uuid default gen_random_uuid() not null,
  wing_id uuid not null,
  flat_no text not null,
  floor text,
  carpet_sqm numeric(8,2),
  carpet_sqft numeric(8,2),
  status text,
  holder_name text,
  agreement_no text,
  agreement_date date,
  updated_at timestamp with time zone default now() not null,
  phone text,
  org_id uuid not null,
  constraint flats_wing_id_flat_no_key UNIQUE (wing_id, flat_no),
  constraint flats_pkey PRIMARY KEY (id)
);

create table public.installment_templates (
  id uuid default gen_random_uuid() not null,
  name text not null,
  org_id uuid not null,
  constraint installment_templates_name_key UNIQUE (name),
  constraint installment_templates_pkey PRIMARY KEY (id)
);

create table public.organizations (
  id uuid default gen_random_uuid() not null,
  name text not null,
  is_demo boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint organizations_pkey PRIMARY KEY (id)
);

create table public.payments (
  id uuid default gen_random_uuid() not null,
  flat_id uuid not null,
  paid_on date default CURRENT_DATE not null,
  amount numeric(14,2) not null,
  note text,
  created_at timestamp with time zone default now() not null,
  org_id uuid not null,
  constraint payments_pkey PRIMARY KEY (id),
  constraint payments_amount_check CHECK ((amount > (0)::numeric))
);

create table public.profiles (
  id uuid not null,
  role text default 'customer'::text not null,
  full_name text,
  phone text,
  created_at timestamp with time zone default now() not null,
  org_id uuid,
  disabled boolean default false not null,
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'customer'::text, 'demo'::text])))
);

create table public.projects (
  id uuid default gen_random_uuid() not null,
  name text not null,
  address text,
  created_at timestamp with time zone default now() not null,
  org_id uuid not null,
  constraint projects_pkey PRIMARY KEY (id)
);

create table public.stages (
  id uuid default gen_random_uuid() not null,
  project_id uuid not null,
  "position" integer not null,
  name text not null,
  org_id uuid not null,
  constraint stages_pkey PRIMARY KEY (id)
);

create table public.statuses (
  name text not null,
  counts_in_sales boolean default false not null,
  constraint statuses_pkey PRIMARY KEY (name)
);

create table public.template_items (
  template_id uuid not null,
  stage_id uuid not null,
  percent numeric(6,2) not null,
  org_id uuid not null,
  constraint template_items_pkey PRIMARY KEY (template_id, stage_id)
);

create table public.wings (
  id uuid default gen_random_uuid() not null,
  project_id uuid not null,
  name text not null,
  current_stage_id uuid,
  org_id uuid not null,
  constraint wings_project_id_name_key UNIQUE (project_id, name),
  constraint wings_pkey PRIMARY KEY (id)
);

-- ============ FOREIGN KEYS ============

alter table public.documents add constraint documents_flat_id_fkey FOREIGN KEY (flat_id) REFERENCES public.flats(id) ON DELETE CASCADE;
alter table public.documents add constraint documents_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.drive_items add constraint drive_items_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.drive_items add constraint drive_items_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.drive_items(id) ON DELETE CASCADE;
alter table public.flat_charges add constraint flat_charges_flat_id_fkey FOREIGN KEY (flat_id) REFERENCES public.flats(id) ON DELETE CASCADE;
alter table public.flat_charges add constraint flat_charges_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.flat_installments add constraint flat_installments_flat_id_fkey FOREIGN KEY (flat_id) REFERENCES public.flats(id) ON DELETE CASCADE;
alter table public.flat_installments add constraint flat_installments_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.flat_installments add constraint flat_installments_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON DELETE RESTRICT;
alter table public.flats add constraint flats_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.flats add constraint flats_status_fkey FOREIGN KEY (status) REFERENCES public.statuses(name) ON UPDATE CASCADE;
alter table public.flats add constraint flats_wing_id_fkey FOREIGN KEY (wing_id) REFERENCES public.wings(id) ON DELETE CASCADE;
alter table public.installment_templates add constraint installment_templates_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_flat_id_fkey FOREIGN KEY (flat_id) REFERENCES public.flats(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.projects add constraint projects_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.stages add constraint stages_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.stages add constraint stages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
alter table public.template_items add constraint template_items_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.template_items add constraint template_items_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON DELETE CASCADE;
alter table public.template_items add constraint template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.installment_templates(id) ON DELETE CASCADE;
alter table public.wings add constraint wings_current_stage_id_fkey FOREIGN KEY (current_stage_id) REFERENCES public.stages(id) ON DELETE SET NULL;
alter table public.wings add constraint wings_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
alter table public.wings add constraint wings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- ============ INDEXES ============

CREATE INDEX documents_flat_id_idx ON public.documents USING btree (flat_id);
CREATE INDEX documents_org_idx ON public.documents USING btree (org_id);
CREATE INDEX documents_storage_path_idx ON public.documents USING btree (storage_path);
CREATE INDEX drive_items_org_idx ON public.drive_items USING btree (org_id);
CREATE INDEX drive_items_parent_idx ON public.drive_items USING btree (parent_id);
CREATE INDEX drive_items_storage_path_idx ON public.drive_items USING btree (storage_path);
CREATE INDEX flat_charges_flat_id_idx ON public.flat_charges USING btree (flat_id);
CREATE INDEX flat_charges_org_idx ON public.flat_charges USING btree (org_id);
CREATE INDEX flat_installments_flat_id_idx ON public.flat_installments USING btree (flat_id);
CREATE INDEX flat_installments_org_idx ON public.flat_installments USING btree (org_id);
CREATE INDEX flats_org_idx ON public.flats USING btree (org_id);
CREATE INDEX installment_templates_org_idx ON public.installment_templates USING btree (org_id);
CREATE INDEX payments_flat_id_idx ON public.payments USING btree (flat_id);
CREATE INDEX payments_org_idx ON public.payments USING btree (org_id);
CREATE INDEX projects_org_idx ON public.projects USING btree (org_id);
CREATE INDEX stages_org_idx ON public.stages USING btree (org_id);
CREATE INDEX template_items_org_idx ON public.template_items USING btree (org_id);
CREATE INDEX wings_org_idx ON public.wings USING btree (org_id);

-- ============ FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not disabled) $function$
;

CREATE OR REPLACE FUNCTION public.my_org()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select org_id from public.profiles where id = auth.uid() and not disabled $function$
;

CREATE OR REPLACE FUNCTION public.my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select role from public.profiles where id = auth.uid() and not disabled $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_org_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

-- ============ VIEW ============

create or replace view public.flat_summary with (security_invoker=true) as
 SELECT f.id,
    f.wing_id,
    f.flat_no,
    f.floor,
    f.carpet_sqm,
    f.carpet_sqft,
    f.status,
    f.holder_name,
    f.agreement_no,
    f.agreement_date,
    f.updated_at,
    f.phone,
    COALESCE(s.counts_in_sales, false) AS is_sale,
    COALESCE(c.total, 0::numeric) AS total_amount,
    COALESCE(c.agreement, 0::numeric) AS agreement_value,
    COALESCE(p.paid, 0::numeric) AS received_amount,
    COALESCE(c.total, 0::numeric) - COALESCE(p.paid, 0::numeric) AS balance_amount,
    cur.name AS stage_name,
    i.cum AS stage_percent,
        CASE
            WHEN COALESCE(s.counts_in_sales, false) AND cur.id IS NOT NULL THEN GREATEST(0::numeric, COALESCE(c.agreement, 0::numeric) * i.cum / 100::numeric - COALESCE(p.paid, 0::numeric))
            ELSE 0::numeric
        END AS due_now,
        CASE
            WHEN COALESCE(s.counts_in_sales, false) AND cur.id IS NOT NULL THEN GREATEST(0::numeric, COALESCE(c.agreement, 0::numeric) * i.cum / 100::numeric + (COALESCE(c.total, 0::numeric) - COALESCE(c.agreement, 0::numeric)) - COALESCE(p.paid, 0::numeric))
            ELSE 0::numeric
        END AS due_with_charges
   FROM public.flats f
     JOIN public.wings w ON w.id = f.wing_id
     LEFT JOIN public.statuses s ON s.name = f.status
     LEFT JOIN public.stages cur ON cur.id = w.current_stage_id
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(fi.percent), 0::numeric) AS cum
           FROM public.flat_installments fi
             JOIN public.stages st ON st.id = fi.stage_id
          WHERE fi.flat_id = f.id AND cur.id IS NOT NULL AND st."position" <= cur."position") i ON true
     LEFT JOIN ( SELECT flat_charges.flat_id,
            sum(flat_charges.amount) AS total,
            sum(flat_charges.amount) FILTER (WHERE flat_charges.name = 'Agreement value'::text) AS agreement
           FROM public.flat_charges
          GROUP BY flat_charges.flat_id) c ON c.flat_id = f.id
     LEFT JOIN ( SELECT payments.flat_id,
            sum(payments.amount) AS paid
           FROM public.payments
          GROUP BY payments.flat_id) p ON p.flat_id = f.id;

-- ============ TRIGGERS ============

CREATE TRIGGER flats_touch BEFORE UPDATE ON public.flats FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.flats FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.flat_charges FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.flat_installments FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.drive_items FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.installment_templates FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.template_items FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.wings FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org BEFORE INSERT OR UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

-- ============ ROW LEVEL SECURITY ============

alter table public.documents enable row level security;
alter table public.drive_items enable row level security;
alter table public.flat_charges enable row level security;
alter table public.flat_installments enable row level security;
alter table public.flats enable row level security;
alter table public.installment_templates enable row level security;
alter table public.organizations enable row level security;
alter table public.payments enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.stages enable row level security;
alter table public.statuses enable row level security;
alter table public.template_items enable row level security;
alter table public.wings enable row level security;

-- Org-scoped tables: read for admin or same org; write for admin or customer in same org (demo is read-only)

create policy "org read" on public.documents as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.documents as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "org read" on public.drive_items as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.drive_items as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "org read" on public.flat_charges as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.flat_charges as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "org read" on public.flat_installments as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.flat_installments as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "org read" on public.flats as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.flats as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "org read" on public.installment_templates as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.installment_templates as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "org admin all" on public.organizations as permissive for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
create policy "org self read" on public.organizations as permissive for select to authenticated
  using ((public.is_admin() OR (id = ( SELECT public.my_org() AS my_org))));

create policy "org read" on public.payments as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.payments as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

-- Profiles: users read their own row; only admin can write (nobody can promote themselves)
create policy "admin profiles" on public.profiles as permissive for all to public
  using (public.is_admin())
  with check (public.is_admin());
create policy "own profile" on public.profiles as permissive for select to public
  using (((id = auth.uid()) OR public.is_admin()));

create policy "org read" on public.projects as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.projects as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "org read" on public.stages as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.stages as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "admin statuses" on public.statuses as permissive for all to public
  using (public.is_admin())
  with check (public.is_admin());
create policy "read statuses" on public.statuses as permissive for select to authenticated
  using (true);

create policy "org read" on public.template_items as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.template_items as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "org read" on public.wings as permissive for select to authenticated
  using ((public.is_admin() OR (org_id = ( SELECT public.my_org() AS my_org))));
create policy "org write" on public.wings as permissive for all to authenticated
  using ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))))
  with check ((public.is_admin() OR ((org_id = ( SELECT public.my_org() AS my_org)) AND (( SELECT public.my_role() AS my_role) = 'customer'::text))));

-- ============ STORAGE ============

insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('drive', 'drive', false) on conflict (id) do nothing;

create policy "documents delete" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'documents'::text) AND (public.is_admin() OR ((( SELECT public.my_role() AS my_role) = 'customer'::text) AND ((owner_id = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM public.documents d
  WHERE (d.storage_path = objects.name))))))));
create policy "documents read" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'documents'::text) AND (public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.documents d
  WHERE (d.storage_path = objects.name))))));
create policy "documents upload" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'documents'::text) AND (public.is_admin() OR (( SELECT public.my_role() AS my_role) = 'customer'::text))));

create policy "drive delete" on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'drive'::text) AND (public.is_admin() OR ((( SELECT public.my_role() AS my_role) = 'customer'::text) AND ((owner_id = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM public.drive_items di
  WHERE (di.storage_path = objects.name))))))));
create policy "drive read" on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'drive'::text) AND (public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.drive_items di
  WHERE (di.storage_path = objects.name))))));
create policy "drive upload" on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'drive'::text) AND (public.is_admin() OR (( SELECT public.my_role() AS my_role) = 'customer'::text))));
