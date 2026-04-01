const SUPABASE_CONFIG_PATH = './supabase.credentials.json';
const WEBHOOK_URL = '';

const state = {
  supabase: null,
  session: null,
  currentThreadId: null,
  pollTimer: null,
};

const ui = {
  openChatBtn: document.getElementById('openChatBtn'),
  chatModal: document.getElementById('chatModal'),
  closeChatBtn: document.getElementById('closeChatBtn'),
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  sessionInfo: document.getElementById('sessionInfo'),
  logoutBtn: document.getElementById('logoutBtn'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  loginBtn: document.getElementById('loginBtn'),
  registerEmail: document.getElementById('registerEmail'),
  registerPassword: document.getElementById('registerPassword'),
  registerBtn: document.getElementById('registerBtn'),
  otpEmail: document.getElementById('otpEmail'),
  sendOtpBtn: document.getElementById('sendOtpBtn'),
  otpCode: document.getElementById('otpCode'),
  verifyOtpBtn: document.getElementById('verifyOtpBtn'),
};

function setAuthUi() {
  const loggedIn = Boolean(state.session?.user);
  ui.openChatBtn.disabled = !loggedIn;
  ui.logoutBtn.disabled = !loggedIn;
  ui.sessionInfo.textContent = loggedIn
    ? `Eingeloggt als ${state.session.user.email}`
    : 'Nicht eingeloggt';
}

function addMessage(text, role) {
  const node = document.createElement('div');
  node.className = `message ${role === 'assistant' ? 'bot' : 'user'}`;
  node.textContent = text;
  ui.chatMessages.appendChild(node);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

function clearPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

async function loadConfig() {
  const response = await fetch(SUPABASE_CONFIG_PATH);
  if (!response.ok) {
    throw new Error('Konnte supabase.credentials.json nicht laden.');
  }

  const config = await response.json();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('In supabase.credentials.json fehlen supabaseUrl oder supabaseAnonKey.');
  }

  return config;
}

async function initSupabase() {
  const config = await loadConfig();
  state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

  const { data } = await state.supabase.auth.getSession();
  state.session = data.session;
  setAuthUi();

  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    setAuthUi();
    if (session?.user) {
      ensureProfile(session.user).catch((error) => {
        console.error('Profil konnte nicht synchronisiert werden', error);
      });
    }
  });

  if (state.session?.user) {
    await ensureProfile(state.session.user);
  }
}

function getProfileName(user) {
  const meta = user.user_metadata ?? {};
  return (
    meta.full_name ||
    meta.name ||
    (user.email ? user.email.split('@')[0] : null) ||
    'Unbekannt'
  );
}

async function ensureProfile(user) {
  if (!user?.id) {
    return;
  }

  const payload = {
    id: user.id,
    email: user.email,
    name: getProfileName(user),
  };

  const { error } = await state.supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(`Profil konnte nicht angelegt werden: ${error.message}`);
  }
}

async function login() {
  const email = ui.loginEmail.value.trim();
  const password = ui.loginPassword.value;
  const { error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert(`Login fehlgeschlagen: ${error.message}`);
  }
}

async function register() {
  const email = ui.registerEmail.value.trim();
  const password = ui.registerPassword.value;
  const { error } = await state.supabase.auth.signUp({ email, password });
  if (error) {
    alert(`Registrierung fehlgeschlagen: ${error.message}`);
    return;
  }

  alert('Registrierung erfolgreich. Falls E-Mail-Bestätigung aktiv ist: bitte Mail bestätigen.');
}

async function sendOtp() {
  const email = ui.otpEmail.value.trim();
  const { error } = await state.supabase.auth.signInWithOtp({ email });
  if (error) {
    alert(`OTP senden fehlgeschlagen: ${error.message}`);
    return;
  }

  alert('OTP wurde per E-Mail gesendet.');
}

async function verifyOtp() {
  const email = ui.otpEmail.value.trim();
  const token = ui.otpCode.value.trim();
  const { error } = await state.supabase.auth.verifyOtp({ email, token, type: 'email' });

  if (error) {
    alert(`OTP Verifikation fehlgeschlagen: ${error.message}`);
  }
}

async function triggerWebhook() {
  const uid = state.session?.user?.id;
  if (!WEBHOOK_URL || !uid) {
    return;
  }

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, type: 0 }),
  });
}

async function createFreshThread() {
  await ensureProfile(state.session.user);

  if (state.currentThreadId) {
    await state.supabase.from('chat_threads').delete().eq('id', state.currentThreadId);
    state.currentThreadId = null;
  }

  const { data, error } = await state.supabase
    .from('chat_threads')
    .insert({ profile_id: state.session.user.id })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  state.currentThreadId = data.id;
}

async function deleteCurrentThread() {
  clearPolling();
  if (!state.currentThreadId) {
    return;
  }

  await state.supabase.from('chat_threads').delete().eq('id', state.currentThreadId);
  state.currentThreadId = null;
}

async function pollForAssistantReply() {
  clearPolling();

  state.pollTimer = setInterval(async () => {
    const { data, error } = await state.supabase
      .from('chat_messages')
      .select('id, message')
      .eq('thread_id', state.currentThreadId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return;
    }

    if (data && data.length > 0) {
      addMessage(data[0].message, 'assistant');
      clearPolling();
    }
  }, 2000);
}

async function sendChatMessage(event) {
  event.preventDefault();
  const message = ui.chatInput.value.trim();
  if (!message || !state.currentThreadId) {
    return;
  }

  const { error } = await state.supabase.from('chat_messages').insert({
    thread_id: state.currentThreadId,
    profile_id: state.session.user.id,
    role: 'user',
    message,
  });

  if (error) {
    alert(`Nachricht konnte nicht gespeichert werden: ${error.message}`);
    return;
  }

  addMessage(message, 'user');
  ui.chatInput.value = '';

  await triggerWebhook();
  await pollForAssistantReply();
}

async function openChat() {
  try {
    ui.chatMessages.innerHTML = '';
    await createFreshThread();
    ui.chatModal.classList.remove('hidden');
  } catch (error) {
    alert(`Chat konnte nicht geöffnet werden: ${error.message}`);
  }
}

async function closeChat() {
  ui.chatModal.classList.add('hidden');
  ui.chatMessages.innerHTML = '';
  await deleteCurrentThread();
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));

      tab.classList.add('active');
      const panelId = `${tab.dataset.tab}Panel`;
      document.getElementById(panelId).classList.add('active');
    });
  });
}

function bindEvents() {
  ui.loginBtn.addEventListener('click', login);
  ui.registerBtn.addEventListener('click', register);
  ui.sendOtpBtn.addEventListener('click', sendOtp);
  ui.verifyOtpBtn.addEventListener('click', verifyOtp);
  ui.logoutBtn.addEventListener('click', () => state.supabase.auth.signOut());

  ui.openChatBtn.addEventListener('click', openChat);
  ui.closeChatBtn.addEventListener('click', closeChat);
  ui.chatForm.addEventListener('submit', sendChatMessage);
}

(async function boot() {
  setupTabs();
  bindEvents();
  try {
    await initSupabase();
  } catch (error) {
    alert(error.message);
  }
})();
