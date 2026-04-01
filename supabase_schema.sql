-- Supabase Chat Tabellen + Policies
-- In Supabase SQL Editor ausführen

create extension if not exists pgcrypto;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "threads_owner_select" on public.chat_threads;
create policy "threads_owner_select"
  on public.chat_threads
  for select
  using (auth.uid() = profile_id);

drop policy if exists "threads_owner_insert" on public.chat_threads;
create policy "threads_owner_insert"
  on public.chat_threads
  for insert
  with check (auth.uid() = profile_id);

drop policy if exists "threads_owner_delete" on public.chat_threads;
create policy "threads_owner_delete"
  on public.chat_threads
  for delete
  using (auth.uid() = profile_id);

drop policy if exists "messages_owner_select" on public.chat_messages;
create policy "messages_owner_select"
  on public.chat_messages
  for select
  using (auth.uid() = profile_id);

drop policy if exists "messages_owner_insert" on public.chat_messages;
create policy "messages_owner_insert"
  on public.chat_messages
  for insert
  with check (auth.uid() = profile_id);

drop policy if exists "messages_owner_delete" on public.chat_messages;
create policy "messages_owner_delete"
  on public.chat_messages
  for delete
  using (auth.uid() = profile_id);

create index if not exists idx_chat_messages_thread_created_at
  on public.chat_messages(thread_id, created_at desc);
