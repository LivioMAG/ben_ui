import { initProtectedPage, logActivity, showMessage, formatDate } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

let customers = [];

async function loadCustomersForSelect() {
  const supabase = await getSupabase();
  const { data } = await supabase.from('customers').select('id, company_name').order('company_name');
  customers = data || [];
  const sel = document.getElementById('customer_id');
  sel.innerHTML = customers.map((c) => `<option value='${c.id}'>${c.company_name}</option>`).join('');
}

async function loadProjects() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('projects').select('*, customers(company_name)').order('created_at', { ascending: false });
  if (error) return showMessage('page-message', error.message, true);

  const tbody = document.querySelector('#projects-table tbody');
  tbody.innerHTML = data.map((p) => `<tr><td><a href='/project-detail.html?id=${p.id}'>${p.project_title}</a></td><td>${p.customers?.company_name || ''}</td><td>${p.status}</td><td>${formatDate(p.start_date)}</td><td>${formatDate(p.end_date)}</td><td><button data-edit='${JSON.stringify(p)}'>Bearbeiten</button><button data-del='${p.id}'>Löschen</button></td></tr>`).join('');
  tbody.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => fillForm(JSON.parse(b.dataset.edit)));
  tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => removeProject(b.dataset.del));
}

function fillForm(p) {
  const form = document.getElementById('project-form');
  Object.entries({ id: p.id, project_title: p.project_title, customer_id: p.customer_id, site_name: p.site_name, site_address: p.site_address, description: p.description, start_date: p.start_date, end_date: p.end_date, status: p.status }).forEach(([k, v]) => form[k].value = v || '');
}

async function removeProject(id) {
  if (!confirm('Projekt löschen?')) return;
  const supabase = await getSupabase();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (!error) {
    await logActivity('project_deleted', `Projekt gelöscht: ${id}`);
    loadProjects();
  }
}

async function bindProjectForm() {
  const form = document.getElementById('project-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    const payload = {
      project_title: form.project_title.value,
      customer_id: form.customer_id.value,
      site_name: form.site_name.value,
      site_address: form.site_address.value,
      description: form.description.value,
      start_date: form.start_date.value,
      end_date: form.end_date.value || null,
      status: form.status.value
    };
    const id = form.id.value;
    const { error } = id
      ? await supabase.from('projects').update(payload).eq('id', id)
      : await supabase.from('projects').insert([payload]);
    if (error) return showMessage('page-message', error.message, true);
    await logActivity(id ? 'project_updated' : 'project_created', `Projekt: ${payload.project_title}`);
    form.reset(); form.id.value = '';
    loadProjects();
  });
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN] });
  if (!auth) return;
  await loadCustomersForSelect();
  await bindProjectForm();
  await loadProjects();
})();
