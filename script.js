const CONFIG_PATH = "./config/supabase.credentials.json";
const CONFIG_EXAMPLE_PATH = "./config/supabase.credentials.example.json";

const statusEl = document.getElementById("status");
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".auth-form");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const otpForm = document.getElementById("otpForm");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const sendResetBtn = document.getElementById("sendResetBtn");

let supabaseClient = null;
let authConfig = null;

void init();

async function init() {
  setupTabs();
  authConfig = await loadConfig();
  setupAuthClient();
  bindEvents();
}

async function loadConfig() {
  const defaultConfig = {
    supabaseUrl: "https://YOUR-PROJECT-ID.supabase.co",
    supabaseAnonKey: "YOUR-ANON-KEY",
    redirectTo: window.location.origin
  };

  const response = await fetch(CONFIG_PATH).catch(() => null);
  if (!response || !response.ok) {
    setStatus(
      `Config fehlt: ${CONFIG_PATH}. Bitte ${CONFIG_EXAMPLE_PATH} kopieren und ausfüllen.`,
      "error"
    );
    return defaultConfig;
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
  sendOtpBtn.addEventListener("click", onSendOtp);
  verifyOtpBtn.addEventListener("click", onVerifyOtp);
  sendResetBtn.addEventListener("click", onResetPassword);

  if (window.location.hash.includes("access_token")) {
    setStatus("Reset-Link erkannt. Du kannst nun ein neues Passwort setzen (späterer Screen).", "success");
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

  setStatus("Login erfolgreich. Weiterleitung zum Dashboard vorbereiten.", "success");
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

async function onSendOtp() {
  if (!assertClient()) return;

  const data = new FormData(otpForm);
  const email = String(data.get("email") || "").trim();

  if (!email) {
    setStatus("Bitte zuerst eine E-Mail eingeben.", "error");
    return;
  }

  setStatus("OTP wird per E-Mail versendet…");

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: authConfig.redirectTo }
  });

  if (error) {
    setStatus(`OTP-Versand fehlgeschlagen: ${error.message}`, "error");
    return;
  }

  setStatus("OTP gesendet. Bitte E-Mail prüfen und den 6-stelligen Code eingeben.", "success");
}

async function onVerifyOtp() {
  if (!assertClient()) return;

  const data = new FormData(otpForm);
  const email = String(data.get("email") || "").trim();
  const token = String(data.get("otpCode") || "").trim();

  if (!email || !token) {
    setStatus("Bitte E-Mail und OTP-Code ausfüllen.", "error");
    return;
  }

  setStatus("OTP wird geprüft…");

  const { error } = await supabaseClient.auth.verifyOtp({
    email,
    token,
    type: "email"
  });

  if (error) {
    setStatus(`OTP ungültig: ${error.message}`, "error");
    return;
  }

  setStatus("OTP korrekt. Du bist jetzt angemeldet.", "success");
}

async function onResetPassword() {
  if (!assertClient()) return;

  const data = new FormData(otpForm);
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

function assertClient() {
  if (supabaseClient) return true;
  setStatus("Supabase nicht initialisiert. Konfiguriere zuerst die JSON-Datei.", "error");
  return false;
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type) statusEl.classList.add(type);
}
