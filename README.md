# NebulaRTC – WebRTC Desktop App (Supabase)

## Überblick

Dieses Repo enthält ein leichtgewichtiges Frontend (HTML/CSS/JS) für eine futuristische, helle WebRTC-Plattform:

- Login mit **E-Mail + Passwort**
- Registrierung mit **E-Mail + Passwort**
- **Passwort vergessen via OTP-Code** (E-Mail-Code eingeben, verifizieren, einloggen)
- Main-Screen (PC-optimiert) mit Raumverwaltung und WebRTC-Statistiken

Backend ist **Supabase**.

## Supabase Credentials via JSON

Lege eine Datei `config/supabase.credentials.json` an (nicht committen) auf Basis von:

- `config/supabase.credentials.example.json`

Beispiel:

```json
{
  "supabaseUrl": "https://YOUR-PROJECT-ID.supabase.co",
  "supabaseAnonKey": "YOUR-ANON-KEY",
  "redirectTo": "http://127.0.0.1:5500"
}
```

Die App lädt diese Datei direkt und initialisiert damit den Supabase-Client.

## SQL für Supabase

Für das neue WebRTC-MVP Schema gibt es:

- `db/supabase_webrtc_schema.sql`

Diese Datei kannst du direkt im Supabase SQL Editor ausführen.

Enthaltene Tabellen:

- `rtc_user_profiles`
- `rtc_rooms`
- `rtc_room_participants`
- `rtc_peer_sessions`
- `rtc_signaling_events`

## Start

1. `config/supabase.credentials.example.json` nach `config/supabase.credentials.json` kopieren.
2. `supabaseUrl` und `supabaseAnonKey` eintragen.
3. In Supabase Auth E-Mail-Provider aktivieren.
4. `index.html` im Browser öffnen.
5. Registrieren oder einloggen.

## Hinweise zu OTP (Passwort vergessen)

- Im Tab **Passwort vergessen** E-Mail eingeben und OTP senden.
- Den zugesendeten 6-stelligen Code eingeben.
- `Code verifizieren & einloggen` klicken.
