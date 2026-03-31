-- Bodenleger Firmen-Tool - Supabase Schema
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin','mitarbeiter')) default 'mitarbeiter',
  first_name text,
  last_name text,
  phone text,
  entry_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  project_title text not null,
  site_name text,
  site_address text,
  description text,
  start_date date not null,
  end_date date,
  status text not null check (status in ('geplant','aktiv','pausiert','abgeschlossen')) default 'geplant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  document_type text not null,
  expires_at date,
  file_path text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null check (category in ('Offerte','Vertrag','Plan','Rechnung','Rapport','Foto','Sonstiges')),
  title text not null,
  file_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null check (category in ('vorher','währenddessen','nachher','mangel','zusatzarbeit')),
  title text not null,
  description text,
  file_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  entry_date date not null,
  start_time time,
  end_time time,
  description text,
  status text not null default 'geplant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete set null,
  entry_date date not null,
  hours numeric(5,2) not null check (hours >= 0),
  start_time time,
  end_time time,
  break_minutes int,
  note text,
  status text not null check (status in ('erfasst','geprüft','freigegeben')) default 'erfasst',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  report_date date not null,
  calendar_week int not null,
  work_description text not null,
  used_material text,
  special_incidents text,
  hours numeric(5,2),
  status text not null check (status in ('entwurf','eingereicht','freigegeben')) default 'entwurf',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.site_reports(id) on delete cascade,
  title text,
  file_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kanban_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.kanban_boards(id) on delete cascade,
  title text not null,
  position bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.kanban_columns(id) on delete cascade,
  title text not null,
  description text,
  image_path text,
  position bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customers','projects','employees_documents','project_files','project_photos',
    'planner_entries','time_entries','site_reports','site_report_photos','kanban_boards','kanban_columns','kanban_cards'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I;', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- RLS deaktivieren
alter table public.profiles disable row level security;
alter table public.customers disable row level security;
alter table public.projects disable row level security;
alter table public.employees_documents disable row level security;
alter table public.project_files disable row level security;
alter table public.project_photos disable row level security;
alter table public.planner_entries disable row level security;
alter table public.time_entries disable row level security;
alter table public.site_reports disable row level security;
alter table public.site_report_photos disable row level security;
alter table public.kanban_boards disable row level security;
alter table public.kanban_columns disable row level security;
alter table public.kanban_cards disable row level security;
alter table public.activity_logs disable row level security;

-- Storage Buckets (nur einmal anlegen)
insert into storage.buckets (id, name, public)
values
  ('employee-documents', 'employee-documents', false),
  ('project-files', 'project-files', false),
  ('report-photos', 'report-photos', false),
  ('kanban-images', 'kanban-images', false),
  ('project-photos', 'project-photos', false)
on conflict (id) do nothing;
