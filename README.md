# Bodenleger Firmen-Tool (Vanilla JS + Supabase)

Web-Tool für eine kleine Bodenleger-Firma mit Rollen `admin` und `mitarbeiter`.

## Funktionsumfang

- Login mit E-Mail/Passwort
- Passwort vergessen (E-Mail Reset)
- OTP Login via E-Mail
- Rollenbasierte Oberfläche (`admin` / `mitarbeiter`)
- Admin-Module: Dashboard, Kunden, Mitarbeiter inkl. Dokumente, Projekte, Projektdateien/Fotos, Wochenplaner, Kanban
- Mitarbeiter-Module: Eigene Stunden und eigene Rapporte
- Datei-Uploads über Supabase Storage
- Aktivitäten-Log

## Projektstruktur

- `index.html`, `login.html`, `dashboard.html`, `customers.html`, `employees.html`, `projects.html`, `project-detail.html`, `planner.html`, `time-tracking.html`, `reports.html`, `kanban.html`
- `assets/css/styles.css`
- `assets/js/*.js` (modular getrennt nach Verantwortlichkeiten)
- `config/supabase.json` (URL + Public Key)
- `sql/schema.sql` (komplette DB-Struktur + Buckets + RLS deaktiviert)

## Voraussetzungen

- Supabase Projekt
- Webserver lokal (z. B. VSCode Live Server oder `python -m http.server`)

## Supabase Setup

1. In Supabase SQL Editor den Inhalt aus `sql/schema.sql` ausführen.
2. In **Authentication > Providers > Email** aktivieren.
3. **Wichtig:** Öffentliche Registrierung deaktivieren (`Enable email signups` ausschalten).
4. Storage Buckets werden über SQL angelegt.

## Konfiguration

Datei `config/supabase.json` ausfüllen:

```json
{
  "supabaseUrl": "HIER_MEINE_URL",
  "supabaseAnonKey": "HIER_MEIN_PUBLIC_KEY"
}
```

## Benutzer anlegen (Admin + Mitarbeiter)

Da es keine Registrierung im Frontend gibt:

1. Nutzer in Supabase unter **Authentication > Users** anlegen.
2. Danach passenden Eintrag in `profiles` erzeugen (z. B. via SQL):

```sql
insert into public.profiles (id, email, role, first_name, last_name)
values
  ('AUTH_USER_UUID_ADMIN', 'admin@firma.ch', 'admin', 'Admin', 'User'),
  ('AUTH_USER_UUID_MA', 'ma@firma.ch', 'mitarbeiter', 'Max', 'Mitarbeiter');
```

`id` muss exakt der `auth.users.id` entsprechen.

## Lokal starten

Beispiel:

```bash
cd /workspace/ben_ui
python -m http.server 8080
```

Dann im Browser öffnen:

- `http://localhost:8080/login.html`

## Hinweise

- App ist auf Desktop/Web optimiert.
- Fokus ist funktionale, modulare Struktur ohne Framework.
- RLS ist laut Anforderung deaktiviert.
