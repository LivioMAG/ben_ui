-- =========================================================
-- NebulaRTC / Supabase Startschema (MVP)
-- Fokus: Login + WebRTC Desktop Main-Screen
-- Hinweis: Diese Version ist absichtlich OHNE RLS
-- =========================================================

create extension if not exists pgcrypto;

-- Benutzerprofil (zusätzlich zu auth.users)
create table if not exists rtc_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
alter table rtc_user_profiles disable row level security;

-- Räume
create table if not exists rtc_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_name text not null,
  room_mode text not null default 'mesh' check (room_mode in ('mesh', 'sfu')),
  room_status text not null default 'active' check (room_status in ('active', 'paused', 'closed')),
  max_participants int not null default 8 check (max_participants between 2 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rtc_rooms_owner_id on rtc_rooms(owner_id);
alter table rtc_rooms disable row level security;

-- Teilnehmer pro Raum
create table if not exists rtc_room_participants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references rtc_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  role text not null default 'guest' check (role in ('host', 'producer', 'guest')),
  is_online boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index if not exists idx_rtc_participants_owner_id on rtc_room_participants(owner_id);
create index if not exists idx_rtc_participants_room_id on rtc_room_participants(room_id);
alter table rtc_room_participants disable row level security;

-- Peer Sessions
create table if not exists rtc_peer_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references rtc_rooms(id) on delete cascade,
  participant_id uuid references rtc_room_participants(id) on delete set null,
  peer_id text not null,
  session_state text not null default 'connecting'
    check (session_state in ('connecting', 'connected', 'reconnecting', 'failed', 'ended')),
  local_sdp text,
  remote_sdp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rtc_sessions_owner_id on rtc_peer_sessions(owner_id);
create index if not exists idx_rtc_sessions_room_id on rtc_peer_sessions(room_id);
alter table rtc_peer_sessions disable row level security;

-- Signaling Events (Metrik / Debug)
create table if not exists rtc_signaling_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references rtc_rooms(id) on delete cascade,
  event_type text not null
    check (event_type in ('offer', 'answer', 'ice_candidate', 'join', 'leave', 'heartbeat')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_rtc_signals_owner_id on rtc_signaling_events(owner_id);
create index if not exists idx_rtc_signals_room_id on rtc_signaling_events(room_id);
create index if not exists idx_rtc_signals_created_at on rtc_signaling_events(created_at);
alter table rtc_signaling_events disable row level security;
