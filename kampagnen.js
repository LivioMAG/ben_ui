const CONFIG_PATH = "./config/supabase.credentials.json";
const CONFIG_EXAMPLE_PATH = "./config/supabase.credentials.example.json";

const statusEl = document.getElementById("status");
const form = document.getElementById("roomForm");
const tableBody = document.getElementById("roomTableBody");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const userInfo = document.getElementById("userInfo");

const statRooms = document.getElementById("statRooms");
const statParticipants = document.getElementById("statParticipants");
const statSignals = document.getElementById("statSignals");
const statSessions = document.getElementById("statSessions");

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
  userInfo.textContent = `${sessionUser.email} · Desktop WebRTC Workspace`;

  bindEvents();
  await loadDashboardData();
}

function bindEvents() {
  form.addEventListener("submit", onCreateRoom);
  logoutBtn.addEventListener("click", onLogout);
  refreshBtn.addEventListener("click", () => void loadDashboardData());
}

async function onCreateRoom(event) {
  event.preventDefault();

  const data = new FormData(form);
  const name = String(data.get("roomName") || "").trim();
  const mode = String(data.get("roomMode") || "mesh").trim();
  const maxParticipants = Number(data.get("maxParticipants") || 8);

  if (!name) {
    setStatus("Bitte gib einen Raumnamen ein.", "error");
    return;
  }

  const payload = {
    owner_id: sessionUser.id,
    room_name: name,
    room_mode: mode,
    max_participants: maxParticipants,
    room_status: "active"
  };

  const { error } = await supabaseClient.from("rtc_rooms").insert(payload);

  if (error) {
    setStatus(`Raum konnte nicht erstellt werden: ${error.message}`, "error");
    return;
  }

  form.reset();
  document.getElementById("roomMode").value = "mesh";
  document.getElementById("maxParticipants").value = "8";
  setStatus("Raum erfolgreich erstellt.", "success");
  await loadDashboardData();
}

async function loadDashboardData() {
  await Promise.all([loadRooms(), loadStats()]);
}

async function loadRooms() {
  const { data, error } = await supabaseClient
    .from("rtc_rooms")
    .select("id,room_name,room_mode,max_participants,room_status,created_at")
    .eq("owner_id", sessionUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(`Räume konnten nicht geladen werden: ${error.message}`, "error");
    return;
  }

  renderRooms(data || []);
}

async function loadStats() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [roomsRes, participantsRes, signalsRes, sessionsRes] = await Promise.all([
    supabaseClient.from("rtc_rooms").select("id", { count: "exact", head: true }).eq("owner_id", sessionUser.id),
    supabaseClient
      .from("rtc_room_participants")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", sessionUser.id)
      .eq("is_online", true),
    supabaseClient
      .from("rtc_signaling_events")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", sessionUser.id)
      .gte("created_at", since),
    supabaseClient
      .from("rtc_peer_sessions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", sessionUser.id)
      .eq("session_state", "connected")
  ]);

  statRooms.textContent = String(roomsRes.count || 0);
  statParticipants.textContent = String(participantsRes.count || 0);
  statSignals.textContent = String(signalsRes.count || 0);
  statSessions.textContent = String(sessionsRes.count || 0);
}

function renderRooms(rooms) {
  if (!rooms.length) {
    tableBody.innerHTML = '<tr><td colspan="5">Noch keine Räume vorhanden.</td></tr>';
    return;
  }

  tableBody.innerHTML = rooms
    .map(
      (room) => `
      <tr>
        <td>${escapeHtml(room.room_name)}</td>
        <td>${escapeHtml(room.room_mode.toUpperCase())}</td>
        <td>${room.max_participants}</td>
        <td>${escapeHtml(room.room_status)}</td>
        <td>${formatDate(room.created_at)}</td>
      </tr>`
    )
    .join("");
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
