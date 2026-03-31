import { initProtectedPage, showMessage } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

let weekOffset = 0;

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

async function loadOptions() {
  const supabase = await getSupabase();
  const [{ data: employees }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('id,first_name,last_name,email').order('email'),
    supabase.from('projects').select('id,project_title').order('project_title')
  ]);
  document.getElementById('planner_employee_id').innerHTML = employees.map((e) => `<option value='${e.id}'>${e.first_name || ''} ${e.last_name || ''} (${e.email})</option>`).join('');
  document.getElementById('planner_project_id').innerHTML = projects.map((p) => `<option value='${p.id}'>${p.project_title}</option>`).join('');
}

async function loadPlanner() {
  const supabase = await getSupabase();
  const { monday, sunday } = getWeekRange(weekOffset);
  document.getElementById('planner-week').textContent = `${monday.toLocaleDateString('de-CH')} - ${sunday.toLocaleDateString('de-CH')}`;
  const { data, error } = await supabase.from('planner_entries').select('*, profiles(email), projects(project_title)')
    .gte('entry_date', monday.toISOString().slice(0, 10))
    .lte('entry_date', sunday.toISOString().slice(0, 10)).order('entry_date');
  if (error) return showMessage('page-message', error.message, true);
  const tbody = document.querySelector('#planner-table tbody');
  tbody.innerHTML = data.map((e) => `<tr><td>${e.entry_date}</td><td>${e.profiles?.email || ''}</td><td>${e.projects?.project_title || ''}</td><td>${e.start_time || ''} - ${e.end_time || ''}</td><td>${e.description || ''}</td><td>${e.status}</td></tr>`).join('');
}

async function bindForm() {
  const form = document.getElementById('planner-form');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const supabase = await getSupabase();
    const payload = {
      employee_id: form.employee_id.value,
      project_id: form.project_id.value,
      entry_date: form.entry_date.value,
      start_time: form.start_time.value || null,
      end_time: form.end_time.value || null,
      description: form.description.value,
      status: form.status.value
    };
    const { error } = await supabase.from('planner_entries').insert([payload]);
    if (error) return showMessage('page-message', error.message, true);
    form.reset();
    loadPlanner();
  });

  document.getElementById('prev-week').onclick = () => { weekOffset -= 1; loadPlanner(); };
  document.getElementById('next-week').onclick = () => { weekOffset += 1; loadPlanner(); };
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN] });
  if (!auth) return;
  await loadOptions();
  await bindForm();
  await loadPlanner();
})();
