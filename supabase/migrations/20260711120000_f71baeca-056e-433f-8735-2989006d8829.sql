-- Data import/export templates, shared across all users and linked to a specific
-- table (table_key). Previously the "Template Designer" page (/templates) only
-- kept its schemas in localStorage, so nothing designed there was reachable from
-- any actual import/export flow, and every mapping had to be redone per browser.
create table if not exists public.data_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'import',
  table_key text not null,
  fields jsonb not null default '[]'::jsonb,
  mapping jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  history jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists data_templates_table_key_idx on public.data_templates(table_key);

alter table public.data_templates enable row level security;

-- Templates are import/export schema metadata only (field names, column mapping) —
-- no financial or personal data — so any authenticated internal user can read and
-- manage them as a shared team resource, consistent with how the previous
-- localStorage version had no access restriction at all.
create policy data_templates_select on public.data_templates
  for select using (auth.uid() is not null);

create policy data_templates_insert on public.data_templates
  for insert with check (auth.uid() is not null);

create policy data_templates_update on public.data_templates
  for update using (auth.uid() is not null);

create policy data_templates_delete on public.data_templates
  for delete using (auth.uid() is not null);

CREATE OR REPLACE FUNCTION public.data_templates_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

create trigger data_templates_updated_at
  before update on public.data_templates
  for each row execute function public.data_templates_set_updated_at();
