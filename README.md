# ben_ui

Lokales Dashboard für drei JSON-Datenquellen:

- `landing.json`
- `funnel.json`
- `config.json`

## Start

```bash
python3 -m http.server 4173
```

Dann im Browser öffnen:

- `http://localhost:4173/index.html`

## Verhalten

- Drawer mit 3 Bereichen: Funnel, Landingpage, Config.
- Alle JSON-Values sind editierbar (rekursiv), Keys bleiben unverändert.
- Arrays unterstützen dynamisches Hinzufügen/Löschen von Einträgen.
- **Speichern** persistiert aktuell als Dummy in `localStorage`.
- **Neu laden** lädt aus `localStorage` (falls vorhanden), sonst aus den JSON-Dateien.

## Supabase-ready

In `app.js` ist die Persistenz über ein `storage`-Objekt gekapselt.
Die Methode `save()` erzeugt bereits ein Payload mit:

- `section`
- `updatedAt`
- `data`

Damit kann später direkt ein `upsert`/`select` gegen Supabase umgesetzt werden.
