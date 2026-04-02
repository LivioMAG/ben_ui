const SUPABASE_CONFIG_PATH = './supabase.credentials.json';

const CHANNEL_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  google_adwords: 'Google AdWords',
};

const DEFAULT_QUESTIONS = [
  'Wer benutzt dieses Produkt? (z. B. Privatperson, Business, Hobby, problemgetrieben)',
  'Welche Gruppen könnten dieses Produkt kaufen? (Nenne idealerweise 3 konkrete Gruppen)',
  'Kannst du die Gruppe weiter eingrenzen? (z. B. Alter, Beruf, Lebenssituation, Alltag)',
  'Warum würde diese Person dieses Produkt kaufen? (z. B. Problem lösen, Status, Zeit sparen, Leidenschaft, Sicherheit, Anerkennung)',
  'Wie dringend oder emotional ist das Bedürfnis? (Ist es eher dringend, emotional wichtig oder nur ein Nice-to-have?)',
  'Kann die Zielgruppe sich das leisten und ist sie bereit, Geld dafür auszugeben?',
  'Kann ich diese Zielgruppe gezielt erreichen? (z. B. über Plattformen, Communities, Interessen, Kanäle)',
];

const WORKFLOW_STEP_CONFIG = [
  { key: 'usage', label: 'Nutzung klären' },
  { key: 'hypothesis', label: 'Hypothesen' },
  { key: 'segmentation', label: 'Segmentierung' },
  { key: 'motivation', label: 'Motivation' },
  { key: 'trigger', label: 'Trigger' },
  { key: 'payment', label: 'Zahlungsfähigkeit' },
  { key: 'reachability', label: 'Erreichbarkeit' },
];

const state = {
  supabase: null,
  session: null,
  chatPollTimer: null,
  workflowPollTimer: null,
  shownAssistantMessageIds: new Set(),
  campaigns: [],
  selectedCampaignId: null,
  workflows: [],
  selectedWorkflowId: null,
  workflowSnapshot: null,
  currentThreadId: null,
  ephemeralThreadId: null,
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
  authCard: document.getElementById('authCard'),
  campaignOverview: document.getElementById('campaignOverview'),
  campaignForm: document.getElementById('campaignForm'),
  campaignName: document.getElementById('campaignName'),
  campaignList: document.getElementById('campaignList'),
  campaignEmpty: document.getElementById('campaignEmpty'),
  campaignDetail: document.getElementById('campaignDetail'),
  backToOverviewBtn: document.getElementById('backToOverviewBtn'),
  campaignDetailTitle: document.getElementById('campaignDetailTitle'),
  campaignDetailMeta: document.getElementById('campaignDetailMeta'),
  campaignStatusSelect: document.getElementById('campaignStatusSelect'),
  saveCampaignStatusBtn: document.getElementById('saveCampaignStatusBtn'),
  newWorkflowBtn: document.getElementById('newWorkflowBtn'),
  workflowEmpty: document.getElementById('workflowEmpty'),
  workflowCards: document.getElementById('workflowCards'),
  workflowEditor: document.getElementById('workflowEditor'),
  workflowEditorTitle: document.getElementById('workflowEditorTitle'),
  workflowModal: null,
  workflowModalTitle: null,
  closeWorkflowModalBtn: null,
  workflowTimeline: null,
  workflowChatMessages: null,
  workflowChatForm: null,
  workflowChatInput: null,
};

function setAuthUi() {
  const loggedIn = Boolean(state.session?.user);
  ui.openChatBtn.disabled = !loggedIn;
  ui.logoutBtn.disabled = !loggedIn;
  ui.sessionInfo.textContent = loggedIn
    ? `Eingeloggt als ${state.session.user.email}`
    : 'Nicht eingeloggt';

  ui.authCard.classList.toggle('hidden', loggedIn);
  if (!loggedIn) {
    ui.campaignOverview.classList.add('hidden');
    ui.campaignDetail.classList.add('hidden');
    ui.workflowModal?.classList.add('hidden');
    clearChatPolling();
    clearWorkflowPolling();
    return;
  }

  if (state.selectedCampaignId) {
    ui.campaignDetail.classList.remove('hidden');
    ui.campaignOverview.classList.add('hidden');
  } else {
    ui.campaignOverview.classList.remove('hidden');
    ui.campaignDetail.classList.add('hidden');
  }
}

function addMessage(text, role) {
  const node = document.createElement('div');
  node.className = `message ${role === 'assistant' ? 'bot' : 'user'}`;
  node.textContent = text;
  ui.chatMessages.appendChild(node);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

function addAssistantMessageIfNew(row) {
  if (!row?.id || state.shownAssistantMessageIds.has(row.id)) {
    return false;
  }

  state.shownAssistantMessageIds.add(row.id);
  addMessage(row.message, 'assistant');
  return true;
}

function clearChatPolling() {
  if (state.chatPollTimer) {
    clearInterval(state.chatPollTimer);
    state.chatPollTimer = null;
  }
}

function clearWorkflowPolling() {
  if (state.workflowPollTimer) {
    clearInterval(state.workflowPollTimer);
    state.workflowPollTimer = null;
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

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (!session?.user) {
      state.selectedCampaignId = null;
      state.campaigns = [];
      state.workflows = [];
      state.selectedWorkflowId = null;
      renderCampaigns();
      setAuthUi();
      return;
    }

    try {
      await ensureProfile(session.user);
      await loadCampaigns();
    } catch (error) {
      alert(error.message);
    }

    setAuthUi();
  });

  if (state.session?.user) {
    await ensureProfile(state.session.user);
    await loadCampaigns();
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

function renderCampaigns() {
  ui.campaignList.innerHTML = '';

  if (state.campaigns.length === 0) {
    ui.campaignEmpty.classList.remove('hidden');
    return;
  }

  ui.campaignEmpty.classList.add('hidden');

  state.campaigns.forEach((campaign) => {
    const item = document.createElement('article');
    item.className = 'campaign-item';

    const channels = (campaign.channels || [])
      .map((key) => CHANNEL_LABELS[key] || key)
      .join(', ');

    item.innerHTML = `
      <div class="campaign-item-head">
        <strong>${campaign.name}</strong>
        <span class="badge ${campaign.status}">${campaign.status === 'active' ? 'Aktiv' : 'Inaktiv'}</span>
      </div>
      <div>Kanäle: ${channels || '–'}</div>
      <button type="button" data-open-campaign="${campaign.id}">Kampagne öffnen</button>
    `;

    ui.campaignList.appendChild(item);
  });
}

function getSelectedWorkflow() {
  return state.workflows.find((workflow) => workflow.id === state.selectedWorkflowId) || null;
}

function computeWorkflowProgress(workflow) {
  let completed = 0;
  for (let index = 1; index <= 7; index += 1) {
    if (workflow[`q${index}_is_valid`]) {
      completed += 1;
    }
  }

  return {
    completed,
    current: Math.min(completed + 1, 7),
  };
}

function renderWorkflowTimeline(workflow) {
  if (!ui.workflowTimeline || !window.TargetPopup) {
    return;
  }

  window.TargetPopup.renderTimeline(ui.workflowTimeline, workflow, WORKFLOW_STEP_CONFIG);
}

function renderWorkflowEditor(workflow) {
  if (!workflow) {
    return;
  }

  ui.workflowEditor.classList.remove('hidden');
  ui.workflowEditorTitle.textContent = `Zielgruppe · ${workflow.final_summary || 'Neue Zielgruppe'}`;
  ui.workflowModalTitle.textContent = `Zielgruppe · ${workflow.final_summary || 'Neue Zielgruppe'}`;
  renderWorkflowTimeline(workflow);
}

function renderWorkflows() {
  ui.workflowCards.innerHTML = '';

  if (state.workflows.length === 0) {
    ui.workflowEmpty.classList.remove('hidden');
    renderWorkflowEditor(null);
    return;
  }

  ui.workflowEmpty.classList.add('hidden');

  state.workflows.forEach((workflow) => {
    const progress = computeWorkflowProgress(workflow);
    const card = document.createElement('article');
    card.className = 'workflow-card';
    card.innerHTML = `
      <strong>${workflow.final_summary || 'Zusammenfassung noch leer'}</strong>
      <p>Status: ${workflow.status} · Fortschritt: ${progress.completed}/7</p>
      <button type="button" data-open-workflow="${workflow.id}">Im Popup öffnen</button>
    `;
    ui.workflowCards.appendChild(card);
  });

  renderWorkflowEditor(getSelectedWorkflow());
}

async function openCampaignDetail(campaignId) {
  const campaign = state.campaigns.find((entry) => entry.id === campaignId);
  if (!campaign) {
    return;
  }

  state.selectedCampaignId = campaignId;
  ui.campaignDetailTitle.textContent = campaign.name;
  ui.campaignStatusSelect.value = campaign.status;

  const channels = (campaign.channels || [])
    .map((key) => CHANNEL_LABELS[key] || key)
    .join(', ');

  ui.campaignDetailMeta.textContent = `Kanäle: ${channels || '–'} · Erstellt am ${new Date(campaign.created_at).toLocaleString('de-DE')}`;

  ui.campaignOverview.classList.add('hidden');
  ui.campaignDetail.classList.remove('hidden');
  state.selectedWorkflowId = null;
  await loadWorkflows();
}

function backToCampaignOverview() {
  state.selectedCampaignId = null;
  state.workflows = [];
  state.selectedWorkflowId = null;
  ui.campaignOverview.classList.remove('hidden');
  ui.campaignDetail.classList.add('hidden');
  closeWorkflowModal().catch(() => {});
}

async function loadCampaigns() {
  const profileId = state.session?.user?.id;
  if (!profileId) {
    return;
  }

  const { data, error } = await state.supabase
    .from('campaigns')
    .select('id, name, channels, status, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Kampagnen konnten nicht geladen werden: ${error.message}`);
  }

  state.campaigns = data || [];
  renderCampaigns();
}

async function loadWorkflows() {
  if (!state.selectedCampaignId || !state.session?.user?.id) {
    return;
  }

  const { data, error } = await state.supabase
    .from('campaign_target_audiences')
    .select('*')
    .eq('profile_id', state.session.user.id)
    .eq('campaign_id', state.selectedCampaignId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Zielgruppen konnten nicht geladen werden: ${error.message}`);
  }

  state.workflows = data || [];
  if (!state.workflows.some((workflow) => workflow.id === state.selectedWorkflowId)) {
    state.selectedWorkflowId = state.workflows[0]?.id || null;
  }
  renderWorkflows();
}

async function createWorkflow() {
  if (!state.selectedCampaignId || !state.session?.user?.id) {
    return;
  }

  const insertPayload = {
    profile_id: state.session.user.id,
    campaign_id: state.selectedCampaignId,
    session_id: crypto.randomUUID(),
    product_input: ui.campaignDetailTitle.textContent || 'Produkt',
    status: 'draft',
    current_step: 1,
  };

  DEFAULT_QUESTIONS.forEach((question, index) => {
    const n = index + 1;
    insertPayload[`q${n}_question`] = question;
    insertPayload[`q${n}_is_valid`] = false;
  });

  const { error } = await state.supabase.from('campaign_target_audiences').insert(insertPayload);
  if (error) {
    alert(`Zielgruppe konnte nicht angelegt werden: ${error.message}`);
    return;
  }

  await loadWorkflows();
  const newestWorkflow = state.workflows[0];
  if (newestWorkflow) {
    await openWorkflowModal(newestWorkflow.id);
  }
}

async function createCampaign(event) {
  event.preventDefault();

  const profileId = state.session?.user?.id;
  const name = ui.campaignName.value.trim();
  if (!profileId || !name) {
    return;
  }

  const channels = Array.from(document.querySelectorAll('input[name="channels"]:checked'))
    .map((input) => input.value)
    .filter((channel) => channel === 'instagram');

  if (channels.length === 0) {
    alert('Aktuell ist nur Instagram verfügbar.');
    return;
  }

  const { error } = await state.supabase.from('campaigns').insert({
    profile_id: profileId,
    name,
    channels,
    status: 'active',
  });

  if (error) {
    alert(`Kampagne konnte nicht gespeichert werden: ${error.message}`);
    return;
  }

  ui.campaignForm.reset();
  const instagramInput = document.querySelector('input[name="channels"][value="instagram"]');
  if (instagramInput) {
    instagramInput.checked = true;
  }

  await loadCampaigns();
}

async function saveCampaignStatus() {
  const campaignId = state.selectedCampaignId;
  if (!campaignId) {
    return;
  }

  const status = ui.campaignStatusSelect.value;
  const { error } = await state.supabase
    .from('campaigns')
    .update({ status })
    .eq('id', campaignId)
    .eq('profile_id', state.session.user.id);

  if (error) {
    alert(`Status konnte nicht gespeichert werden: ${error.message}`);
    return;
  }

  await loadCampaigns();
  openCampaignDetail(campaignId);
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

async function createFreshThread({ chatType = 0, targetDocumentId = null, targetTable = null } = {}) {
  await ensureProfile(state.session.user);

  if (chatType === 0 && state.ephemeralThreadId) {
    await state.supabase.from('chat_threads').delete().eq('id', state.ephemeralThreadId);
    state.ephemeralThreadId = null;
  }

  const { data, error } = await state.supabase
    .from('chat_threads')
    .insert({
      profile_id: state.session.user.id,
      chat_type: chatType,
      target_document_id: targetDocumentId,
      target_table: targetTable,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  state.currentThreadId = data.id;
  if (chatType === 0) {
    state.ephemeralThreadId = data.id;
  }
  state.shownAssistantMessageIds = new Set();
}

async function deleteCurrentThread() {
  clearChatPolling();
  if (!state.ephemeralThreadId) {
    state.currentThreadId = null;
    return;
  }

  await state.supabase.from('chat_threads').delete().eq('id', state.ephemeralThreadId);
  state.currentThreadId = null;
  state.ephemeralThreadId = null;
  state.shownAssistantMessageIds = new Set();
}

async function pollForAssistantReply(lastUserMessageCreatedAt) {
  clearChatPolling();

  state.chatPollTimer = setInterval(async () => {
    const { data, error } = await state.supabase
      .from('chat_messages')
      .select('id, message, created_at')
      .eq('thread_id', state.currentThreadId)
      .eq('role', 'assistant')
      .gt('created_at', lastUserMessageCreatedAt)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return;
    }

    if (data && data.length > 0) {
      const appended = addAssistantMessageIfNew(data[0]);
      if (appended) {
        clearChatPolling();
      }
    }
  }, 2000);
}

async function sendChatMessage(event) {
  event.preventDefault();
  const message = ui.chatInput.value.trim();
  if (!message || !state.currentThreadId) {
    return;
  }

  const { data, error } = await state.supabase
    .from('chat_messages')
    .insert({
      thread_id: state.currentThreadId,
      role: 'user',
      message,
    })
    .select('created_at')
    .single();

  if (error) {
    alert(`Nachricht konnte nicht gespeichert werden: ${error.message}`);
    return;
  }

  addMessage(message, 'user');
  ui.chatInput.value = '';

  await pollForAssistantReply(data.created_at);
}

async function openChat() {
  try {
    ui.chatMessages.innerHTML = '';
    await createFreshThread({ chatType: 0 });
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

async function refreshSelectedWorkflow() {
  const workflow = getSelectedWorkflow();
  if (!workflow || !state.session?.user?.id) {
    return;
  }

  const { data, error } = await state.supabase
    .from('campaign_target_audiences')
    .select('*')
    .eq('id', workflow.id)
    .eq('profile_id', state.session.user.id)
    .single();

  if (error || !data) {
    return;
  }

  const snapshot = JSON.stringify({
    last_completed_step: data.last_completed_step,
    current_step: data.current_step,
    status: data.status,
    q1_is_valid: data.q1_is_valid,
    q2_is_valid: data.q2_is_valid,
    q3_is_valid: data.q3_is_valid,
    q4_is_valid: data.q4_is_valid,
    q5_is_valid: data.q5_is_valid,
    q6_is_valid: data.q6_is_valid,
    q7_is_valid: data.q7_is_valid,
  });

  if (snapshot === state.workflowSnapshot) {
    return;
  }

  state.workflowSnapshot = snapshot;
  state.workflows = state.workflows.map((entry) => (entry.id === data.id ? data : entry));
  renderWorkflows();
}

function startWorkflowPolling() {
  clearWorkflowPolling();
  state.workflowPollTimer = setInterval(() => {
    refreshSelectedWorkflow().catch(() => {});
  }, 2500);
}

async function openWorkflowModal(workflowId) {
  state.selectedWorkflowId = workflowId;
  const workflow = getSelectedWorkflow();
  if (!workflow || !ui.workflowModal) {
    return;
  }

  ui.workflowChatMessages.innerHTML = '';

  const { data: existingThread } = await state.supabase
    .from('chat_threads')
    .select('id')
    .eq('profile_id', state.session.user.id)
    .eq('chat_type', 1)
    .eq('target_document_id', workflow.id)
    .eq('target_table', 'campaign_target_audiences')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingThread?.id) {
    state.currentThreadId = existingThread.id;
    state.shownAssistantMessageIds = new Set();
  } else {
    await createFreshThread({
      chatType: 1,
      targetDocumentId: workflow.id,
      targetTable: 'campaign_target_audiences',
    });
  }

  const { data: messages } = await state.supabase
    .from('chat_messages')
    .select('id, role, message')
    .eq('thread_id', state.currentThreadId)
    .order('created_at', { ascending: true });

  (messages || []).forEach((row) => {
    const node = document.createElement('div');
    node.className = `message ${row.role === 'assistant' ? 'bot' : 'user'}`;
    node.textContent = row.message;
    ui.workflowChatMessages.appendChild(node);
    if (row.role === 'assistant') {
      state.shownAssistantMessageIds.add(row.id);
    }
  });
  ui.workflowChatMessages.scrollTop = ui.workflowChatMessages.scrollHeight;

  renderWorkflowEditor(workflow);
  state.workflowSnapshot = '';
  ui.workflowModal.classList.remove('hidden');
  startWorkflowPolling();
}

async function closeWorkflowModal() {
  if (!ui.workflowModal) {
    return;
  }

  ui.workflowModal.classList.add('hidden');
  ui.workflowChatMessages.innerHTML = '';
  clearWorkflowPolling();
  state.workflowSnapshot = null;
  state.currentThreadId = null;
  state.shownAssistantMessageIds = new Set();
}

async function sendWorkflowChatMessage(event) {
  event.preventDefault();
  const message = ui.workflowChatInput.value.trim();
  if (!message) {
    return;
  }

  await sendWorkflowTextMessage(message);
}

async function sendWorkflowTextMessage(message) {
  if (!message || !state.currentThreadId) {
    return;
  }

  const { data, error } = await state.supabase
    .from('chat_messages')
    .insert({
      thread_id: state.currentThreadId,
      role: 'user',
      message,
    })
    .select('created_at')
    .single();

  if (error) {
    alert(`Nachricht konnte nicht gespeichert werden: ${error.message}`);
    return;
  }

  const node = document.createElement('div');
  node.className = 'message user';
  node.textContent = message;
  ui.workflowChatMessages.appendChild(node);
  ui.workflowChatMessages.scrollTop = ui.workflowChatMessages.scrollHeight;
  ui.workflowChatInput.value = '';

  clearChatPolling();
  state.chatPollTimer = setInterval(async () => {
    const { data: assistantData, error: assistantError } = await state.supabase
      .from('chat_messages')
      .select('id, message, created_at')
      .eq('thread_id', state.currentThreadId)
      .eq('role', 'assistant')
      .gt('created_at', data.created_at)
      .order('created_at', { ascending: false })
      .limit(1);

    if (assistantError || !assistantData?.length) {
      return;
    }

    const row = assistantData[0];
    if (state.shownAssistantMessageIds.has(row.id)) {
      return;
    }
    state.shownAssistantMessageIds.add(row.id);

    const replyNode = document.createElement('div');
    replyNode.className = 'message bot';
    replyNode.textContent = row.message;
    ui.workflowChatMessages.appendChild(replyNode);
    ui.workflowChatMessages.scrollTop = ui.workflowChatMessages.scrollHeight;
    clearChatPolling();
  }, 2000);
}

async function handleWorkflowCardDrop(event) {
  event.preventDefault();
  const text = event.dataTransfer?.getData('text/plain')?.trim();
  if (!text) {
    return;
  }

  await sendWorkflowTextMessage(text);
}


async function loadTargetPopupTemplate() {
  const mount = document.getElementById('targetPopupMount');
  if (!mount) {
    return;
  }

  const response = await fetch('./popups/target-popup.html');
  if (!response.ok) {
    throw new Error('Target-Popup konnte nicht geladen werden.');
  }

  mount.innerHTML = await response.text();
  ui.workflowModal = document.getElementById('targetModal');
  ui.workflowModalTitle = document.getElementById('targetModalTitle');
  ui.closeWorkflowModalBtn = document.getElementById('closeTargetModalBtn');
  ui.workflowTimeline = document.getElementById('targetTimeline');
  ui.workflowChatMessages = document.getElementById('targetChatMessages');
  ui.workflowChatForm = document.getElementById('targetChatForm');
  ui.workflowChatInput = document.getElementById('targetChatInput');
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

  ui.campaignForm.addEventListener('submit', createCampaign);
  ui.backToOverviewBtn.addEventListener('click', backToCampaignOverview);
  ui.saveCampaignStatusBtn.addEventListener('click', saveCampaignStatus);
  ui.campaignList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-open-campaign]');
    if (!button) {
      return;
    }

    openCampaignDetail(button.dataset.openCampaign).catch((error) => alert(error.message));
  });
  ui.newWorkflowBtn.addEventListener('click', createWorkflow);
  ui.workflowCards.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-open-workflow]');
    if (!button) {
      return;
    }

    openWorkflowModal(button.dataset.openWorkflow).catch((error) => alert(error.message));
  });
  ui.closeWorkflowModalBtn?.addEventListener('click', () => {
    closeWorkflowModal().catch((error) => alert(error.message));
  });
  ui.workflowChatForm?.addEventListener('submit', sendWorkflowChatMessage);
  ui.workflowTimeline?.addEventListener('dragstart', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest('.timeline-item');
    if (!card || card.getAttribute('draggable') !== 'true') {
      return;
    }

    event.dataTransfer.setData('text/plain', card.dataset.dragMessage || '');
    event.dataTransfer.effectAllowed = 'copy';
  });
  ui.workflowChatMessages?.addEventListener('dragover', (event) => {
    event.preventDefault();
    ui.workflowChatMessages.classList.add('is-drop-target');
  });
  ui.workflowChatMessages?.addEventListener('dragleave', () => {
    ui.workflowChatMessages.classList.remove('is-drop-target');
  });
  ui.workflowChatMessages?.addEventListener('drop', (event) => {
    ui.workflowChatMessages.classList.remove('is-drop-target');
    handleWorkflowCardDrop(event).catch((error) => alert(error.message));
  });

  ui.openChatBtn.addEventListener('click', openChat);
  ui.closeChatBtn.addEventListener('click', closeChat);
  ui.chatForm.addEventListener('submit', sendChatMessage);
}

(async function boot() {
  setupTabs();
  await loadTargetPopupTemplate();
  bindEvents();
  try {
    await initSupabase();
  } catch (error) {
    alert(error.message);
  }
})();
