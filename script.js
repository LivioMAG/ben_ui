const CONFIG_PATH = "./config/supabase.credentials.json";
const CONFIG_EXAMPLE_PATH = "./config/supabase.credentials.example.json";

const statusEl = document.getElementById("status");
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".auth-form");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");
const sendResetBtn = document.getElementById("sendResetBtn");
const updatePasswordBtn = document.getElementById("updatePasswordBtn");
const DASHBOARD_PATH = "./kampagnen.html";

let supabaseClient = null;
let authConfig = null;

void init();

async function init() {
  setupTabs();
  authConfig = await loadConfig();
  setupAuthClient();
  bindEvents();
  await redirectIfAlreadyLoggedIn();
}

async function loadConfig() {
  const defaultConfig = {
    supabaseUrl: "https://YOUR-PROJECT-ID.supabase.co",
    supabaseAnonKey: "YOUR-ANON-KEY",
    redirectTo: `${window.location.origin}${window.location.pathname}`
  };

  const response = await fetch(CONFIG_PATH).catch(() => null);
  if (!response || !response.ok) {
    const fallbackResponse = await fetch(CONFIG_EXAMPLE_PATH).catch(() => null);
    if (!fallbackResponse || !fallbackResponse.ok) {
      setStatus(
        `Config fehlt: ${CONFIG_PATH}. Bitte ${CONFIG_EXAMPLE_PATH} kopieren und ausfüllen.`,
        "error"
      );
      return defaultConfig;
    }

    const fallbackParsed = await fallbackResponse.json().catch(() => null);
    if (!fallbackParsed) {
      setStatus("Config JSON ist ungültig formatiert.", "error");
      return defaultConfig;
    }

    setStatus(
      `Hinweis: ${CONFIG_PATH} nicht gefunden. Nutze ${CONFIG_EXAMPLE_PATH} als Fallback.`,
      "success"
    );
    return {
      ...defaultConfig,
      ...fallbackParsed
    };
  }

  const parsed = await response.json().catch(() => null);
  if (!parsed) {
    setStatus("Config JSON ist ungültig formatiert.", "error");
    return defaultConfig;
  }

  return {
    ...defaultConfig,
    ...parsed
  };
}

function setupAuthClient() {
  const isPlaceholder =
    authConfig.supabaseUrl.includes("YOUR-PROJECT-ID") || authConfig.supabaseAnonKey.includes("YOUR-ANON-KEY");

  if (isPlaceholder || !window.supabase?.createClient) {
    setStatus(
      "Supabase ist noch nicht konfiguriert. Trage URL + ANON KEY in config/supabase.credentials.json ein.",
      "error"
    );
    return;
  }

  supabaseClient = window.supabase.createClient(authConfig.supabaseUrl, authConfig.supabaseAnonKey);
  setStatus("Supabase verbunden. Du kannst dich jetzt registrieren und anmelden.", "success");
}

function bindEvents() {
  loginForm.addEventListener("submit", onLoginSubmit);
  registerForm.addEventListener("submit", onRegisterSubmit);
  sendResetBtn.addEventListener("click", onResetPassword);
  updatePasswordBtn.addEventListener("click", onUpdatePassword);

  if (hasRecoveryTokens()) {
    setStatus("Reset-Link erkannt. Bitte unten dein neues Passwort setzen.", "success");
  }
}

function setupTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;

      tabButtons.forEach((btn) => {
        const selected = btn === button;
        btn.classList.toggle("active", selected);
        btn.setAttribute("aria-selected", String(selected));
      });

      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
    });
  });
}

async function onLoginSubmit(event) {
  event.preventDefault();
  if (!assertClient()) return;

  const data = new FormData(loginForm);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");

  setStatus("Login läuft…");

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus(`Login fehlgeschlagen: ${error.message}`, "error");
    return;
  }

  setStatus("Login erfolgreich. Weiterleitung zur Kampagnenübersicht…", "success");
  window.location.assign(DASHBOARD_PATH);
}

async function onRegisterSubmit(event) {
  event.preventDefault();
  if (!assertClient()) return;

  const data = new FormData(registerForm);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  const displayName = String(data.get("displayName") || "").trim();

  setStatus("Registrierung läuft…");

  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: authConfig.redirectTo
    }
  });

  if (error) {
    setStatus(`Registrierung fehlgeschlagen: ${error.message}`, "error");
    return;
  }

  setStatus("Registrierung gestartet. Prüfe deine E-Mail für die Verifizierung.", "success");
}

async function onResetPassword() {
  if (!assertClient()) return;

  const data = new FormData(resetForm);
  const email = String(data.get("email") || "").trim();

  if (!email) {
    setStatus("Bitte eine E-Mail für den Reset eingeben.", "error");
    return;
  }

  setStatus("Passwort-Reset-Link wird gesendet…");

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: authConfig.redirectTo
  });

  if (error) {
    setStatus(`Reset fehlgeschlagen: ${error.message}`, "error");
    return;
  }

  setStatus("Reset-Link gesendet. Bitte Posteingang prüfen.", "success");
}

async function onUpdatePassword() {
  if (!assertClient()) return;
  if (!hasRecoveryTokens()) {
    setStatus("Kein Reset-Token erkannt. Öffne zuerst den Link aus deiner E-Mail.", "error");
    return;
  }

  const data = new FormData(resetForm);
  const password = String(data.get("newPassword") || "").trim();
  if (password.length < 6) {
    setStatus("Das neue Passwort muss mindestens 6 Zeichen haben.", "error");
    return;
  }

  setStatus("Passwort wird aktualisiert…");
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) {
    setStatus(`Passwort konnte nicht gesetzt werden: ${error.message}`, "error");
    return;
  }

  window.history.replaceState({}, document.title, window.location.pathname);
  setStatus("Passwort erfolgreich geändert. Du kannst dich jetzt einloggen.", "success");
}

function hasRecoveryTokens() {
  return window.location.hash.includes("access_token") || window.location.hash.includes("type=recovery");
}

function assertClient() {
  if (supabaseClient) return true;
  setStatus("Supabase nicht initialisiert. Konfiguriere zuerst die JSON-Datei.", "error");
  return false;
}

async function redirectIfAlreadyLoggedIn() {
  if (!supabaseClient || hasRecoveryTokens()) return;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) return;
  window.location.assign(DASHBOARD_PATH);
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type) statusEl.classList.add(type);
}
