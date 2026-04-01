const CONFIG_PATH = "./config/supabase.credentials.json";
const CONFIG_EXAMPLE_PATH = "./config/supabase.credentials.example.json";
const CHAT_POLL_INTERVAL_MS = 5000;

const params = new URLSearchParams(window.location.search);
const campaignId = params.get("id");

const campaignTitleEl = document.getElementById("campaignTitle");
const statusEl = document.getElementById("status");
const systemStatusEl = document.getElementById("systemStatus");
const reportStatusEl = document.getElementById("reportStatus");
const chatMessagesEl = document.getElementById("chatMessages");
const reportMessagesEl = document.getElementById("reportMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const audienceSelect = document.getElementById("audienceSelect");
const audienceForm = document.getElementById("audienceForm");
const resetThreadBtn = document.getElementById("resetThreadBtn");

let supabaseClient = null;
let sessionUser = null;
let threadId = null;
let selectedAudienceId = null;
let pollHandle = null;
let lastMessageAt = null;
let webhookUrl = "";
const renderedMessageIds = new Set();
let pollingEnabled = true;

void init();

async function init() {
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.assign("./kampagnen.html");
  });

  if (!campaignId) {
    setStatus("Keine Kampagnen-ID gefunden.", "error");
    return;
  }

  const config = await loadConfig();
  if (!config) return;

  webhookUrl = String(config.chatWebhookUrl || "").trim();

  supabaseClient = window.supabase?.createClient(config.supabaseUrl, config.supabaseAnonKey);
  if (!supabaseClient) {
    setStatus("Supabase konnte nicht initialisiert werden.", "error");
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.assign("./index.html");
    return;
  }

  sessionUser = data.session.user;

  bindEvents();

  await Promise.all([
    loadCampaign(),
    loadReport(),
    loadAudiences(),
    ensureThreadAndLoadMessages()
  ]);

  startPolling();
}

function bindEvents() {
  chatForm.addEventListener("submit", onSendMessage);
  audienceForm.addEventListener("submit", onCreateAudience);
  audienceSelect.addEventListener("change", onAudienceChange);
  resetThreadBtn.addEventListener("click", onResetThread);

  window.addEventListener("beforeunload", () => {
    if (pollHandle) window.clearInterval(pollHandle);
  });
}

function startPolling() {
  if (pollHandle) window.clearInterval(pollHandle);
  if (!pollingEnabled) return;
  pollHandle = window.setInterval(() => {
    if (!pollingEnabled) return;
    void loadMessages();
  }, CHAT_POLL_INTERVAL_MS);
}

async function loadCampaign() {
  const { data, error } = await supabaseClient
    .from("kampagnen")
    .select("id,name,status")
    .eq("id", campaignId)
    .eq("benutzer_id", sessionUser.id)
    .maybeSingle();

  if (error || !data) {
    campaignTitleEl.textContent = "Kampagne nicht gefunden";
    setStatus(`Kampagne konnte nicht geladen werden: ${error?.message || "Nicht gefunden"}`, "error");
    return;
  }

  campaignTitleEl.textContent = data.name;
  systemStatusEl.value = data.status || "–";
}

async function loadReport() {
  const { data, error } = await supabaseClient
    .from("berichte")
    .select("titel,zusammenfassung,status,erstellt_am")
    .eq("kampagnen_id", campaignId)
    .eq("benutzer_id", sessionUser.id)
    .order("erstellt_am", { ascending: false })
    .limit(1);

  if (error) {
    reportStatusEl.value = "Fehler";
    reportMessagesEl.innerHTML = '<p class="status">Bericht konnte nicht geladen werden.</p>';
    return;
  }

  const latestReport = data?.[0] || null;
  reportStatusEl.value = latestReport?.status || "Kein Bericht";
  renderReport(latestReport);
}

async function ensureThreadAndLoadMessages() {
  const { data, error } = await supabaseClient
    .from("chat_threads")
    .select("id")
    .eq("kampagnen_id", campaignId)
    .eq("benutzer_id", sessionUser.id)
    .order("aktualisiert_am", { ascending: false })
    .limit(1);

  if (error) {
    setStatus(`Chat-Thread konnte nicht geladen werden: ${error.message}`, "error");
    return;
  }

  if (data?.length) {
    threadId = data[0].id;
  } else {
    const { data: inserted, error: insertError } = await supabaseClient
      .from("chat_threads")
      .insert({
        benutzer_id: sessionUser.id,
        kampagnen_id: campaignId,
        titel: "Kampagnen-Chat",
        typ: "kampagne"
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setStatus(`Chat-Thread konnte nicht erstellt werden: ${insertError?.message || "Unbekannter Fehler"}`, "error");
      return;
    }

    threadId = inserted.id;
  }

  await loadMessages();
}

async function loadMessages() {
  if (!threadId || !pollingEnabled) return;

  const query = supabaseClient
    .from("chat_nachrichten")
    .select("id,rolle,nachricht,erstellt_am")
    .eq("thread_id", threadId)
    .order("erstellt_am", { ascending: true });

  if (lastMessageAt) {
    query.gte("erstellt_am", lastMessageAt);
  }

  const { data, error } = await query;

  if (error) {
    setStatus(`Nachrichten konnten nicht geladen werden: ${error.message}`, "error");
    return;
  }

  renderMessages(data || []);
  const newest = data?.[data.length - 1]?.erstellt_am;
  if (newest) lastMessageAt = newest;
}

function renderMessages(messages) {
  if (!messages.length && !chatMessagesEl.children.length) {
    chatMessagesEl.innerHTML = '<p class="status">Noch keine Nachrichten vorhanden.</p>';
    return;
  }

  const freshMessages = messages.filter((msg) => !renderedMessageIds.has(msg.id));
  const hasExternalResponse = freshMessages.some((msg) => msg.rolle !== "benutzer");
  const chatHtml = freshMessages
    .map((msg) => {
      renderedMessageIds.add(msg.id);
      const role = msg.rolle === "benutzer" ? "Du" : msg.rolle === "ki" ? "Jemmy" : "System";
      return `
      <article class="chat-message role-${escapeHtml(msg.rolle)}">
        <header>${role} · ${formatDate(msg.erstellt_am)}</header>
        <p>${escapeHtml(msg.nachricht)}</p>
      </article>`;
    })
    .join("");

  if (!chatHtml && !hasExternalResponse) return;

  if (!chatMessagesEl.querySelector(".chat-message")) {
    chatMessagesEl.innerHTML = chatHtml;
  } else {
    chatMessagesEl.insertAdjacentHTML("beforeend", chatHtml);
  }

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  if (hasExternalResponse) {
    pollingEnabled = false;
    if (pollHandle) window.clearInterval(pollHandle);
    setStatus("KI-Antwort erhalten. Automatisches Nachladen wurde gestoppt.", "success");
  }
}

async function onSendMessage(event) {
  event.preventDefault();
  if (!threadId) {
    setStatus("Chat-Thread ist noch nicht bereit.", "error");
    return;
  }

  const text = chatInput.value.trim();
  if (!text) return;

  const payload = {
    thread_id: threadId,
    benutzer_id: sessionUser.id,
    kampagnen_id: campaignId,
    zielgruppen_id: selectedAudienceId,
    rolle: "benutzer",
    nachricht: text,
    nachricht_typ: "text"
  };

  const { error } = await supabaseClient.from("chat_nachrichten").insert(payload);
  if (error) {
    setStatus(`Nachricht konnte nicht gespeichert werden: ${error.message}`, "error");
    return;
  }

  await supabaseClient
    .from("chat_threads")
    .update({ aktualisiert_am: new Date().toISOString(), zielgruppen_id: selectedAudienceId })
    .eq("id", threadId);

  chatInput.value = "";
  setStatus("Nachricht gesendet.", "success");
  pollingEnabled = true;
  startPolling();
  await triggerWebhook(text);
  await loadMessages();
}

async function onResetThread() {
  if (!threadId) return;

  const confirmDelete = window.confirm("Thread wirklich löschen und Chat zurücksetzen?");
  if (!confirmDelete) return;

  const { error: deleteMessagesError } = await supabaseClient.from("chat_nachrichten").delete().eq("thread_id", threadId);
  if (deleteMessagesError) {
    setStatus(`Nachrichten konnten nicht gelöscht werden: ${deleteMessagesError.message}`, "error");
    return;
  }

  const { error: deleteThreadError } = await supabaseClient.from("chat_threads").delete().eq("id", threadId);
  if (deleteThreadError) {
    setStatus(`Thread konnte nicht gelöscht werden: ${deleteThreadError.message}`, "error");
    return;
  }

  chatMessagesEl.innerHTML = '<p class="status">Noch keine Nachrichten vorhanden.</p>';
  reportMessagesEl.innerHTML = '<p class="status">Noch kein Bericht vorhanden.</p>';
  renderedMessageIds.clear();
  lastMessageAt = null;
  threadId = null;
  pollingEnabled = true;
  startPolling();
  await ensureThreadAndLoadMessages();
  await loadReport();
  setStatus("Thread wurde gelöscht und neu gestartet.", "success");
}

function renderReport(report) {
  if (!report) {
    reportMessagesEl.innerHTML = `
      <article class="report-entry">
        <h3>Das ist ein Bericht, welcher die KI vorschlägt.</h3>
        <p>Aktuell sind in <strong>Berichte</strong> noch keine Daten vorhanden.</p>
      </article>`;
    return;
  }

  reportMessagesEl.innerHTML = `
    <article class="report-entry">
      <p class="report-meta">${formatDate(report.erstellt_am)} · Status: ${escapeHtml(report.status || "neu")}</p>
      <h3>${escapeHtml(report.titel || "Untitled Bericht")}</h3>
      <p>${escapeHtml(report.zusammenfassung || "Keine Zusammenfassung vorhanden.")}</p>
    </article>`;
}

async function triggerWebhook(message) {
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "chat_message_created",
      profile_id: sessionUser.id,
      kampagnen_id: campaignId,
      zielgruppen_id: selectedAudienceId,
      thread_id: threadId,
      message
    })
  }).catch(() => null);
}

async function loadAudiences() {
  const { data, error } = await supabaseClient
    .from("zielgruppen")
    .select("id,name,typ")
    .eq("kampagnen_id", campaignId)
    .eq("benutzer_id", sessionUser.id)
    .order("erstellt_am", { ascending: false });

  if (error) {
    setStatus(`Zielgruppen konnten nicht geladen werden: ${error.message}`, "error");
    return;
  }

  const options = [
    '<option value="">Keine Zielgruppe</option>',
    ...(data || []).map((aud) => `<option value="${aud.id}">${escapeHtml(aud.name)} (${escapeHtml(aud.typ)})</option>`)
  ];

  audienceSelect.innerHTML = options.join("");
}

function onAudienceChange() {
  selectedAudienceId = audienceSelect.value || null;
}

async function onCreateAudience(event) {
  event.preventDefault();

  const formData = new FormData(audienceForm);
  const payload = {
    benutzer_id: sessionUser.id,
    kampagnen_id: campaignId,
    name: String(formData.get("audienceName") || "").trim(),
    typ: String(formData.get("audienceType") || "breit"),
    beschreibung: String(formData.get("audienceDescription") || "").trim() || null,
    tagesbudget: formData.get("audienceBudget") ? Number(formData.get("audienceBudget")) : null,
    status: "aktiv"
  };

  if (!payload.name) {
    setStatus("Bitte einen Namen für die Zielgruppe eingeben.", "error");
    return;
  }

  const { data, error } = await supabaseClient.from("zielgruppen").insert(payload).select("id").single();
  if (error) {
    setStatus(`Zielgruppe konnte nicht erstellt werden: ${error.message}`, "error");
    return;
  }

  audienceForm.reset();
  await loadAudiences();
  selectedAudienceId = data.id;
  audienceSelect.value = data.id;
  setStatus("Zielgruppe erstellt und ausgewählt.", "success");
}

async function loadConfig() {
  const response = await fetch(CONFIG_PATH).catch(() => null);
  const source = response?.ok ? response : await fetch(CONFIG_EXAMPLE_PATH).catch(() => null);

  if (!source || !source.ok) {
    setStatus("Supabase-Konfiguration fehlt.", "error");
    return null;
  }

  const parsed = await source.json().catch(() => null);
  if (!parsed?.supabaseUrl || !parsed?.supabaseAnonKey) {
    setStatus("Supabase-Konfiguration ist ungültig.", "error");
    return null;
  }

  return parsed;
}

function formatDate(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Zurich"
  }).format(new Date(value));
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type) statusEl.classList.add(type);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
