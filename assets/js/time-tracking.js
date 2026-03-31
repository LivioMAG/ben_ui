import { initProtectedPage, showMessage } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

let currentProfile;

async function loadOptions() {
  const supabase = await getSupabase();
  const { data: projects } = await supabase.from('projects').select('id,project_title').order('project_title');
  document.getElementById('project_id').innerHTML = projects.map((p) => `<option value='${p.id}'>${p.project_title}</option>`).join('');

  const employeeSel = document.getElementById('employee_id');
  if (currentProfile.role === ROLES.ADMIN) {
    const { data: employees } = await supabase.from('profiles').select('id,email').order('email');
    employeeSel.innerHTML = employees.map((e) => `<option value='${e.id}'>${e.email}</option>`).join('');
  } else {
    employeeSel.innerHTML = `<option value='${currentProfile.id}'>${currentProfile.email}</option>`;
    employeeSel.disabled = true;
  }
}

async function loadEntries() {
  const supabase = await getSupabase();
  let query = supabase.from('time_entries').select('*, projects(project_title), profiles(email)').order('entry_date', { ascending: false });
  if (currentProfile.role === ROLES.EMPLOYEE) query = query.eq('employee_id', currentProfile.id);
  const { data, error } = await query;
  if (error) return showMessage('page-message', error.message, true);
  document.querySelector('#time-table tbody').innerHTML = data.map((t) => `<tr><td>${t.entry_date}</td><td>${t.profiles?.email || ''}</td><td>${t.projects?.project_title || ''}</td><td>${t.hours}</td><td>${t.status}</td></tr>`).join('');
}

async function bindForm() {
  const form = document.getElementById('time-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    const payload = {
      employee_id: form.employee_id.value,
      project_id: form.project_id.value,
      entry_date: form.entry_date.value,
      hours: Number(form.hours.value),
      start_time: form.start_time.value || null,
      end_time: form.end_time.value || null,
      break_minutes: form.break_minutes.value ? Number(form.break_minutes.value) : null,
      note: form.note.value,
      status: form.status.value
    };
    if (currentProfile.role === ROLES.EMPLOYEE) payload.employee_id = currentProfile.id;
    const { error } = await supabase.from('time_entries').insert([payload]);
    if (error) return showMessage('page-message', error.message, true);
    form.reset();
    loadEntries();
  });
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN, ROLES.EMPLOYEE] });
  if (!auth) return;
  currentProfile = auth.profile;
  await loadOptions();
  await bindForm();
  await loadEntries();
})();
