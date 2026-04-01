-- =========================================================
-- Marketing-AI-Dashboard / Supabase Startschema
-- Testversion OHNE RLS
-- =========================================================

-- Erweiterung für UUIDs
create extension if not exists pgcrypto;

-- =========================================================
-- PROFILE
-- =========================================================
create table if not exists benutzer_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  anzeigename text,
  erstellt_am timestamptz not null default now(),
  letzter_login timestamptz
);

alter table benutzer_profile disable row level security;

-- =========================================================
-- KAMPAGNEN
-- =========================================================
create table if not exists kampagnen (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  plattform text not null default 'facebook',
  externe_kampagnen_id text,
  status text not null default 'aktiv'
    check (status in ('aktiv', 'pausiert', 'entwurf', 'archiviert')),
  waehrung text not null default 'CHF',
  zeitzone text not null default 'Europe/Zurich',
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  zuletzt_synchronisiert timestamptz
);

create index if not exists idx_kampagnen_benutzer_id on kampagnen(benutzer_id);

alter table kampagnen disable row level security;

-- =========================================================
-- ZIELGRUPPEN
-- =========================================================
create table if not exists zielgruppen (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  name text not null,
  typ text not null default 'breit'
    check (typ in ('interessen', 'breit', 'lookalike', 'retargeting', 'custom')),
  beschreibung text,
  externe_adset_id text,
  tagesbudget numeric(12,2),
  status text not null default 'aktiv'
    check (status in ('aktiv', 'pausiert', 'entwurf', 'archiviert')),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create index if not exists idx_zielgruppen_benutzer_id on zielgruppen(benutzer_id);
create index if not exists idx_zielgruppen_kampagnen_id on zielgruppen(kampagnen_id);

alter table zielgruppen disable row level security;

-- =========================================================
-- CREATIVES
-- =========================================================
create table if not exists creatives (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  zielgruppen_id uuid references zielgruppen(id) on delete set null,
  name text,
  asset_typ text not null
    check (asset_typ in ('bild', 'video')),
  speicher_pfad text,
  vorschau_url text,
  haupttext text,
  titel text,
  beschreibung text,
  call_to_action text,
  ziel_url text,
  externe_ad_id text,
  quelle text not null default 'manuell'
    check (quelle in ('manuell', 'ki', 'import')),
  status text not null default 'aktiv'
    check (status in ('entwurf', 'aktiv', 'pausiert', 'archiviert', 'abgelehnt')),
  ki_score numeric(5,2),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create index if not exists idx_creatives_benutzer_id on creatives(benutzer_id);
create index if not exists idx_creatives_kampagnen_id on creatives(kampagnen_id);
create index if not exists idx_creatives_zielgruppen_id on creatives(zielgruppen_id);
create index if not exists idx_creatives_status on creatives(status);

alter table creatives disable row level security;

-- =========================================================
-- CREATIVE METRIKEN (TAGESWERTE)
-- =========================================================
create table if not exists creative_metriken (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  creative_id uuid not null references creatives(id) on delete cascade,
  zielgruppen_id uuid references zielgruppen(id) on delete set null,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  datum date not null,
  impressionen integer not null default 0,
  klicks integer not null default 0,
  ctr numeric(8,4),
  cpc numeric(12,2),
  ausgaben numeric(12,2),
  conversions integer not null default 0,
  cpa numeric(12,2),
  umsatz numeric(12,2),
  roas numeric(12,4),
  erstellt_am timestamptz not null default now(),
  unique (creative_id, datum)
);

create index if not exists idx_creative_metriken_creative_id on creative_metriken(creative_id);
create index if not exists idx_creative_metriken_kampagnen_id on creative_metriken(kampagnen_id);
create index if not exists idx_creative_metriken_zielgruppen_id on creative_metriken(zielgruppen_id);
create index if not exists idx_creative_metriken_datum on creative_metriken(datum);

alter table creative_metriken disable row level security;

-- =========================================================
-- CREATIVE VORSCHLAEGE
-- =========================================================
create table if not exists creative_vorschlaege (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  zielgruppen_id uuid references zielgruppen(id) on delete set null,
  basiert_auf_creative_id uuid references creatives(id) on delete set null,
  titel text,
  asset_typ text not null
    check (asset_typ in ('bild', 'video')),
  speicher_pfad text,
  vorschau_url text,
  haupttext text,
  titel_text text,
  beschreibung text,
  call_to_action text,
  ziel_url text,
  begruendung text,
  vorschlag_typ text not null
    check (vorschlag_typ in ('ersatz', 'variante', 'neuer_ansatz')),
  status text not null default 'vorgeschlagen'
    check (status in ('vorgeschlagen', 'angenommen', 'abgelehnt', 'uebernommen')),
  erstellt_von text not null default 'ki'
    check (erstellt_von in ('ki', 'manuell', 'workflow')),
  erstellt_am timestamptz not null default now(),
  angenommen_am timestamptz
);

create index if not exists idx_creative_vorschlaege_benutzer_id on creative_vorschlaege(benutzer_id);
create index if not exists idx_creative_vorschlaege_kampagnen_id on creative_vorschlaege(kampagnen_id);
create index if not exists idx_creative_vorschlaege_zielgruppen_id on creative_vorschlaege(zielgruppen_id);
create index if not exists idx_creative_vorschlaege_status on creative_vorschlaege(status);

alter table creative_vorschlaege disable row level security;

-- =========================================================
-- BERICHTE (immer auf Kampagnen-Level)
-- =========================================================
create table if not exists berichte (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  bericht_typ text not null
    check (bericht_typ in ('kampagne', 'creative', 'budget')),
  titel text not null,
  zusammenfassung text,
  empfehlungen jsonb not null default '[]'::jsonb,
  workflow_id uuid,
  status text not null default 'neu'
    check (status in ('neu', 'gelesen', 'archiviert')),
  erstellt_am timestamptz not null default now()
);

create index if not exists idx_berichte_benutzer_id on berichte(benutzer_id);
create index if not exists idx_berichte_kampagnen_id on berichte(kampagnen_id);
create index if not exists idx_berichte_status on berichte(status);

alter table berichte disable row level security;

-- =========================================================
-- CHAT THREADS
-- =========================================================
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  zielgruppen_id uuid references zielgruppen(id) on delete set null,
  titel text,
  typ text not null default 'kampagne'
    check (typ in ('kampagne', 'zielgruppe', 'creative', 'allgemein')),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create index if not exists idx_chat_threads_benutzer_id on chat_threads(benutzer_id);
create index if not exists idx_chat_threads_kampagnen_id on chat_threads(kampagnen_id);
create index if not exists idx_chat_threads_zielgruppen_id on chat_threads(zielgruppen_id);

alter table chat_threads disable row level security;

-- =========================================================
-- CHAT NACHRICHTEN
-- =========================================================
create table if not exists chat_nachrichten (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  zielgruppen_id uuid references zielgruppen(id) on delete set null,
  rolle text not null
    check (rolle in ('benutzer', 'ki', 'system')),
  nachricht text not null,
  nachricht_typ text not null default 'text'
    check (nachricht_typ in ('text', 'empfehlung', 'aktion', 'fehler')),
  metadaten jsonb not null default '{}'::jsonb,
  erstellt_am timestamptz not null default now()
);

create index if not exists idx_chat_nachrichten_thread_id on chat_nachrichten(thread_id);
create index if not exists idx_chat_nachrichten_benutzer_id on chat_nachrichten(benutzer_id);
create index if not exists idx_chat_nachrichten_kampagnen_id on chat_nachrichten(kampagnen_id);
create index if not exists idx_chat_nachrichten_erstellt_am on chat_nachrichten(erstellt_am);

alter table chat_nachrichten disable row level security;

-- =========================================================
-- WORKFLOW LAEUFE
-- =========================================================
create table if not exists workflow_lauefe (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  zielgruppen_id uuid references zielgruppen(id) on delete set null,
  typ text not null
    check (typ in ('analyse', 'chat', 'creative_generierung', 'budget_check', 'sync_import')),
  status text not null default 'wartend'
    check (status in ('wartend', 'laufend', 'erfolgreich', 'fehler', 'abgebrochen')),
  gestartet_am timestamptz,
  beendet_am timestamptz,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  fehler text,
  erstellt_am timestamptz not null default now()
);

create index if not exists idx_workflow_lauefe_benutzer_id on workflow_lauefe(benutzer_id);
create index if not exists idx_workflow_lauefe_kampagnen_id on workflow_lauefe(kampagnen_id);
create index if not exists idx_workflow_lauefe_status on workflow_lauefe(status);
create index if not exists idx_workflow_lauefe_typ on workflow_lauefe(typ);

alter table workflow_lauefe disable row level security;

-- =========================================================
-- AKTIONEN
-- =========================================================
create table if not exists aktionen (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid not null references kampagnen(id) on delete cascade,
  zielgruppen_id uuid references zielgruppen(id) on delete set null,
  creative_id uuid references creatives(id) on delete set null,
  vorschlag_id uuid references creative_vorschlaege(id) on delete set null,
  bericht_id uuid references berichte(id) on delete set null,
  typ text not null
    check (typ in ('creative_uebernehmen', 'budget_erhoehen', 'creative_stoppen', 'zielgruppe_erstellen', 'creative_erstellen')),
  status text not null default 'offen'
    check (status in ('offen', 'ausgefuehrt', 'fehler')),
  payload jsonb not null default '{}'::jsonb,
  erstellt_am timestamptz not null default now(),
  ausgefuehrt_am timestamptz
);

create index if not exists idx_aktionen_benutzer_id on aktionen(benutzer_id);
create index if not exists idx_aktionen_kampagnen_id on aktionen(kampagnen_id);
create index if not exists idx_aktionen_status on aktionen(status);

alter table aktionen disable row level security;

-- =========================================================
-- DATEIEN / ASSETS
-- =========================================================
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  benutzer_id uuid not null references auth.users(id) on delete cascade,
  kampagnen_id uuid references kampagnen(id) on delete set null,
  kind text not null
    check (kind in ('bild', 'video', 'skript', 'referenz', 'dokument')),
  speicher_pfad text not null,
  dateiname text,
  mime_typ text,
  dateigroesse bigint,
  metadaten jsonb not null default '{}'::jsonb,
  erstellt_am timestamptz not null default now()
);

create index if not exists idx_assets_benutzer_id on assets(benutzer_id);
create index if not exists idx_assets_kampagnen_id on assets(kampagnen_id);
create index if not exists idx_assets_kind on assets(kind);

alter table assets disable row level security;

-- =========================================================
-- STORAGE BUCKET
-- Bucket per SQL anlegen
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing_assets',
  'marketing_assets',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Optional: Falls du für Tests direkt auf storage.objects zugreifen willst
-- (für echte Nutzung später unbedingt sauber absichern)
alter table storage.objects disable row level security;

-- =========================================================
-- HELFER: updated_at automatisch pflegen
-- =========================================================
create or replace function setze_aktualisiert_am()
returns trigger
language plpgsql
as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$;

drop trigger if exists trg_kampagnen_aktualisiert_am on kampagnen;
create trigger trg_kampagnen_aktualisiert_am
before update on kampagnen
for each row execute function setze_aktualisiert_am();

drop trigger if exists trg_zielgruppen_aktualisiert_am on zielgruppen;
create trigger trg_zielgruppen_aktualisiert_am
before update on zielgruppen
for each row execute function setze_aktualisiert_am();

drop trigger if exists trg_creatives_aktualisiert_am on creatives;
create trigger trg_creatives_aktualisiert_am
before update on creatives
for each row execute function setze_aktualisiert_am();

drop trigger if exists trg_chat_threads_aktualisiert_am on chat_threads;
create trigger trg_chat_threads_aktualisiert_am
before update on chat_threads
for each row execute function setze_aktualisiert_am();

-- =========================================================
-- VIEW: aktive creatives mit letzter metrischer Sicht
-- =========================================================
create or replace view view_aktive_creatives as
select
  c.id,
  c.benutzer_id,
  c.kampagnen_id,
  c.zielgruppen_id,
  c.name,
  c.asset_typ,
  c.vorschau_url,
  c.haupttext,
  c.titel,
  c.call_to_action,
  c.ziel_url,
  c.status,
  c.ki_score,
  m.datum as letztes_datum,
  m.ctr,
  m.cpa,
  m.roas,
  m.ausgaben
from creatives c
left join lateral (
  select cm.*
  from creative_metriken cm
  where cm.creative_id = c.id
  order by cm.datum desc
  limit 1
) m on true
where c.status = 'aktiv';

-- =========================================================
-- VIEW: vorgeschlagene creatives
-- =========================================================
create or replace view view_vorgeschlagene_creatives as
select
  cv.id,
  cv.benutzer_id,
  cv.kampagnen_id,
  cv.zielgruppen_id,
  cv.basiert_auf_creative_id,
  cv.titel,
  cv.asset_typ,
  cv.vorschau_url,
  cv.haupttext,
  cv.titel_text,
  cv.call_to_action,
  cv.ziel_url,
  cv.begruendung,
  cv.vorschlag_typ,
  cv.status,
  cv.erstellt_am
from creative_vorschlaege cv
where cv.status = 'vorgeschlagen';

-- =========================================================
-- BEISPIEL-QUERY: zuletzt erstellter Kampagnen-Report
-- =========================================================
-- select *
-- from berichte
-- where kampagnen_id = 'DEINE-KAMPAGNEN-UUID'
-- order by erstellt_am desc
-- limit 1;
