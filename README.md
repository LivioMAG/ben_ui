# Marketing-AI-Dashboard – Projektüberblick

## Idee

Dieses Projekt ist ein schlankes Marketing-Dashboard mit AI-Unterstützung für Performance-Kampagnen, vor allem für Facebook Ads.

Es soll sich nicht wie ein klassisches Reporting-Tool anfühlen, sondern wie ein digitaler Mitarbeiter, der Kampagnen analysiert, Probleme erkennt, neue Creative-Ideen vorbereitet und dem Benutzer klare nächste Schritte zeigt.

Der Fokus liegt bewusst auf Einfachheit:
- oben die Kampagne mit wenigen KPIs
- links ein kompakter AI-Report
- daneben ein Chat zur Diskussion mit der AI
- darunter Zielgruppen-Auswahl
- darunter zwei einfache Tabellen:
  - aktuelle Creatives
  - vorgeschlagene Creatives

Es gibt keine komplexe visuelle Analysefläche. Das Ziel ist:
**sehen, verstehen, diskutieren, entscheiden.**

---

## Produktlogik

Der Benutzer loggt sich ein und sieht seine eigenen Kampagnen.

Jede Kampagne hat:
- mehrere Zielgruppen
- mehrere aktuelle Creatives
- vorgeschlagene Creatives
- AI-Berichte
- Chat-Verlauf
- Workflow-Historie

Die AI analysiert regelmäßig die Kampagne, z. B. alle paar Tage, und schreibt einen neuen Bericht.

Beispiele für AI-Ausgaben:
- 2 Creatives sind zu schwach
- eine Zielgruppe kann skaliert werden
- Budget kann erhöht werden
- neue Creative-Varianten wurden vorbereitet

Der Benutzer kann mit der AI diskutieren, etwa:
- Warum ist dieses Creative schlecht?
- Mach eine aggressivere Version
- Warum soll das Budget erhöht werden?

Die AI antwortet auf Basis der Kampagnendaten, der Metriken und vorhandener Vorschläge.

---

## Technische Architektur

### Supabase
Supabase ist die zentrale Datenquelle und speichert:
- Benutzerprofile
- Kampagnen
- Zielgruppen
- aktuelle Creatives
- Metriken
- vorgeschlagene Creatives
- AI-Berichte
- Chat-Threads und Chat-Nachrichten
- Workflow-Läufe
- Aktionen
- Assets / Dateiverweise

Außerdem wird Supabase Storage für Bilder, Videos, PDFs und weitere Dateien genutzt.

### n8n
n8n ist die Orchestrierungsschicht.

n8n übernimmt:
- Kampagnenanalysen
- AI-Logik
- Creative-Generierung
- Budget-Prüfungen
- Chat-Verarbeitung
- spätere Synchronisationen mit externen Plattformen

Wichtig:
Supabase ist die Datenbasis.
n8n arbeitet auf diesen Daten und schreibt Ergebnisse wieder zurück.

---

## UI-Prinzip

Das Dashboard soll ultra-minimalistisch sein.

### Bereich 1: Kopf
Zeigt nur die wichtigsten KPI-Werte der aktuellen Kampagne, zum Beispiel:
- ROAS
- CPA

### Bereich 2: AI-Report
Kurze, verständliche Zusammenfassung der wichtigsten Erkenntnisse.
Kein langer Analysetext, sondern klare Aussagen.

Beispiel:
- 2 Creatives sind zu schwach
- 1 Zielgruppe kann skaliert werden
- Budget kann leicht erhöht werden

### Bereich 3: Chat / Diskussion
Ein einfacher Chat, über den der Benutzer mit der AI sprechen kann.
Der Chat ist kein separates Tool, sondern Teil des Dashboards.

### Bereich 4: Zielgruppen
Eine einfache Auswahl der Zielgruppen innerhalb einer Kampagne.
Keine komplizierte Struktur.

### Bereich 5: Aktuelle Creatives
Tabelle mit den laufenden Creatives der ausgewählten Zielgruppe.

### Bereich 6: Vorgeschlagene Creatives
Tabelle mit neuen Vorschlägen der AI.
Diese können übernommen oder verworfen werden.

---

## MVP-Fokus

Die erste Version soll bewusst klein bleiben.

Wichtige Elemente:
- Login
- Kampagnen
- Zielgruppen
- aktuelle Creatives
- vorgeschlagene Creatives
- AI-Berichte
- Chat
- Workflow-Historie

Nicht Teil des MVP:
- Teamfunktionen
- komplexe Rollen
- automatische Facebook-Ausspielung
- überladene Dashboards
- tiefe Rechte- und Freigabelogik

---

## Aktueller Stand im Repo

### Login-Screen (HTML/CSS/JS)
Enthalten ist ein moderner Auth-Screen mit:
- Login mit E-Mail + Passwort
- Registrierung mit E-Mail + Passwort
- Passwort vergessen (Reset-Link per E-Mail)
- Passwort direkt neu setzen nach Recovery-Link

### Supabase-Credentials via JSON
Lege eine Datei `config/supabase.credentials.json` an (nicht committen) auf Basis von:
- `config/supabase.credentials.example.json`

Beispiel:
```json
{
  "supabaseUrl": "https://YOUR-PROJECT-ID.supabase.co",
  "supabaseAnonKey": "YOUR-ANON-KEY",
  "redirectTo": "https://deine-domain.tld/index.html"
}
```

### SQL-Startschema (OHNE RLS)
Die vollständige SQL-Datei zum Initialisieren aller Tabellen (RLS deaktiviert) liegt hier:
- `db/supabase_startschema_ohne_rls.sql`

Diese Datei kannst du 1:1 im Supabase SQL Editor ausführen.

---

## Start

1. `config/supabase.credentials.example.json` nach `config/supabase.credentials.json` kopieren.
2. URL + ANON-Key eintragen.
3. In Supabase Auth E-Mail-Provider und Redirect URL konfigurieren.
4. `index.html` im Browser öffnen.
