-- Supabase Chat + Kampagnen Tabellen + Policies
-- In Supabase SQL Editor ausführen

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      name = excluded.name,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

insert into public.profiles (id, email, name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do update
set email = excluded.email,
    name = excluded.name,
    updated_at = now();

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chat_type integer not null default 0,
  target_document_id uuid,
  target_table text,
  created_at timestamptz not null default now()
);

alter table public.chat_threads
  add column if not exists chat_type integer not null default 0,
  add column if not exists target_document_id uuid,
  add column if not exists target_table text;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  channels text[] not null default array['instagram']::text[],
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at
before update on public.campaigns
for each row
execute function public.set_campaigns_updated_at();

create table if not exists public.campaign_target_audiences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  session_id text not null,
  product_input text not null,
  status text not null default 'draft',
  current_step integer not null default 1,
  last_completed_step integer,
  overall_ai_comment text,
  final_summary text,
  q1_question text not null default 'Wer benutzt dieses Produkt? (z. B. Privatperson, Business, Hobby, problemgetrieben)',
  q1_answer text,
  q1_is_valid boolean default false,
  q1_ai_comment text,
  q2_question text not null default 'Welche Gruppen könnten dieses Produkt kaufen? (Nenne idealerweise 3 konkrete Gruppen)',
  q2_answer text,
  q2_is_valid boolean default false,
  q2_ai_comment text,
  q3_question text not null default 'Kannst du die Gruppe weiter eingrenzen? (z. B. Alter, Beruf, Lebenssituation, Alltag)',
  q3_answer text,
  q3_is_valid boolean default false,
  q3_ai_comment text,
  q4_question text not null default 'Warum würde diese Person dieses Produkt kaufen? (z. B. Problem lösen, Status, Zeit sparen, Leidenschaft, Sicherheit, Anerkennung)',
  q4_answer text,
  q4_is_valid boolean default false,
  q4_ai_comment text,
  q5_question text not null default 'Wie dringend oder emotional ist das Bedürfnis? (Ist es eher dringend, emotional wichtig oder nur ein Nice-to-have?)',
  q5_answer text,
  q5_is_valid boolean default false,
  q5_ai_comment text,
  q6_question text not null default 'Kann die Zielgruppe sich das leisten und ist sie bereit, Geld dafür auszugeben?',
  q6_answer text,
  q6_is_valid boolean default false,
  q6_ai_comment text,
  q7_question text not null default 'Kann ich diese Zielgruppe gezielt erreichen? (z. B. über Plattformen, Communities, Interessen, Kanäle)',
  q7_answer text,
  q7_is_valid boolean default false,
  q7_ai_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_target_audiences_status_check
    check (status in ('draft', 'in_progress', 'completed', 'needs_revision')),
  constraint campaign_target_audiences_current_step_check
    check (current_step between 1 and 7)
);

create or replace function public.set_campaign_target_audiences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_campaign_target_audiences_updated_at on public.campaign_target_audiences;
create trigger trg_campaign_target_audiences_updated_at
before update on public.campaign_target_audiences
for each row
execute function public.set_campaign_target_audiences_updated_at();

create index if not exists idx_campaign_target_audiences_profile_id
  on public.campaign_target_audiences (profile_id);
create index if not exists idx_campaign_target_audiences_campaign_id
  on public.campaign_target_audiences (campaign_id);
create index if not exists idx_campaign_target_audiences_session_id
  on public.campaign_target_audiences (session_id);
create index if not exists idx_campaign_target_audiences_status
  on public.campaign_target_audiences (status);

alter table public.chat_messages
  drop column if exists profile_id;

alter table public.profiles disable row level security;
alter table public.chat_threads disable row level security;
alter table public.chat_messages disable row level security;
alter table public.campaigns disable row level security;
alter table public.campaign_target_audiences disable row level security;
drop policy if exists "Users can view own target audience workflows" on public.campaign_target_audiences;
drop policy if exists "Users can insert own target audience workflows" on public.campaign_target_audiences;
drop policy if exists "Users can update own target audience workflows" on public.campaign_target_audiences;
drop policy if exists "Users can delete own target audience workflows" on public.campaign_target_audiences;
grant select, insert, update, delete on table public.campaign_target_audiences to authenticated;

drop policy if exists "threads_owner_select" on public.chat_threads;
drop policy if exists "threads_owner_insert" on public.chat_threads;
drop policy if exists "threads_owner_delete" on public.chat_threads;

drop policy if exists "messages_owner_select" on public.chat_messages;
drop policy if exists "messages_owner_insert" on public.chat_messages;
drop policy if exists "messages_owner_delete" on public.chat_messages;

drop policy if exists "campaigns_owner_select" on public.campaigns;
drop policy if exists "campaigns_owner_insert" on public.campaigns;
drop policy if exists "campaigns_owner_update" on public.campaigns;
drop policy if exists "campaigns_owner_delete" on public.campaigns;
drop policy if exists "Users can view own target audience workflows" on public.campaign_target_audiences;
drop policy if exists "Users can insert own target audience workflows" on public.campaign_target_audiences;
drop policy if exists "Users can update own target audience workflows" on public.campaign_target_audiences;
drop policy if exists "Users can delete own target audience workflows" on public.campaign_target_audiences;

create policy "Users can view own target audience workflows"
on public.campaign_target_audiences
for select
to authenticated
using (profile_id = auth.uid());

create policy "Users can insert own target audience workflows"
on public.campaign_target_audiences
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "Users can update own target audience workflows"
on public.campaign_target_audiences
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Users can delete own target audience workflows"
on public.campaign_target_audiences
for delete
to authenticated
using (profile_id = auth.uid());

create index if not exists idx_chat_messages_thread_created_at
  on public.chat_messages(thread_id, created_at desc);

create index if not exists idx_campaigns_profile_created_at
  on public.campaigns(profile_id, created_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, delete on table public.chat_threads to authenticated;
grant select, insert, delete on table public.chat_messages to authenticated;
grant select, insert, update, delete on table public.campaigns to authenticated;
grant select, insert, update, delete on table public.campaign_target_audiences to authenticated;
