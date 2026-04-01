const CONFIG_PATH = "./config/supabase.credentials.json";
const CONFIG_EXAMPLE_PATH = "./config/supabase.credentials.example.json";

const statusEl = document.getElementById("status");
const form = document.getElementById("campaignForm");
const tableBody = document.getElementById("campaignTableBody");
const logoutBtn = document.getElementById("logoutBtn");
const settingsBtn = document.getElementById("settingsBtn");

let supabaseClient = null;
let sessionUser = null;

void init();

async function init() {
  const config = await loadConfig();
  if (!config) return;

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
  await loadCampaigns();
}

function bindEvents() {
  form.addEventListener("submit", onCreateCampaign);
  logoutBtn.addEventListener("click", onLogout);
  settingsBtn.addEventListener("click", () => setStatus("Einstellungen folgen im nächsten Schritt.", "success"));
}

async function onCreateCampaign(event) {
  event.preventDefault();

  const data = new FormData(form);
  const name = String(data.get("campaignName") || "").trim();
  const platform = String(data.get("platform") || "instagram").trim();

  if (!name) {
    setStatus("Bitte gib einen Kampagnennamen ein.", "error");
    return;
  }

  const payload = {
    benutzer_id: sessionUser.id,
    name,
    plattform: platform,
    waehrung: "CHF",
    zeitzone: "Europe/Zurich",
    status: "aktiv"
  };

  const { error } = await supabaseClient.from("kampagnen").insert(payload);

  if (error) {
    setStatus(`Kampagne konnte nicht erstellt werden: ${error.message}`, "error");
    return;
  }

  form.reset();
  document.getElementById("platform").value = "instagram";
  setStatus("Kampagne erfolgreich erstellt.", "success");
  await loadCampaigns();
}

async function loadCampaigns() {
  const { data, error } = await supabaseClient
    .from("kampagnen")
    .select("id,name,plattform,waehrung,zeitzone,status,zuletzt_synchronisiert,erstellt_am")
    .eq("benutzer_id", sessionUser.id)
    .order("erstellt_am", { ascending: false });

  if (error) {
    setStatus(`Kampagnen konnten nicht geladen werden: ${error.message}`, "error");
    return;
  }

  renderCampaigns(data || []);
}

function renderCampaigns(campaigns) {
  if (!campaigns.length) {
    tableBody.innerHTML = '<tr><td colspan="7">Noch keine Kampagnen vorhanden.</td></tr>';
    return;
  }

  tableBody.innerHTML = campaigns
    .map(
      (campaign) => `
      <tr data-id="${campaign.id}">
        <td>${escapeHtml(campaign.name)}</td>
        <td>${formatPlatform(campaign.plattform)}</td>
        <td>${escapeHtml(campaign.waehrung)}</td>
        <td>${escapeHtml(campaign.zeitzone)}</td>
        <td>${escapeHtml(campaign.status)}</td>
        <td>${formatDate(campaign.zuletzt_synchronisiert)}</td>
        <td>${formatDate(campaign.erstellt_am)}</td>
      </tr>`
    )
    .join("");

  tableBody.querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      window.location.assign(`./kampagne-detail.html?id=${row.dataset.id}`);
    });
  });
}

async function onLogout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setStatus(`Logout fehlgeschlagen: ${error.message}`, "error");
    return;
  }
  window.location.assign("./index.html");
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

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type) statusEl.classList.add(type);
}

function formatDate(value) {
  if (!value) return "–";
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich"
  }).format(date);
}

function formatPlatform(value) {
  const mapping = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };
  return mapping[value] || value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
