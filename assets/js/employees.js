import { initProtectedPage, logActivity, showMessage, formatDate } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

let profiles = [];

async function loadEmployees() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) return showMessage('page-message', error.message, true);
  profiles = data;
  const tbody = document.querySelector('#employees-table tbody');
  tbody.innerHTML = data.map((p) => `<tr><td>${p.first_name || ''} ${p.last_name || ''}</td><td>${p.email}</td><td>${p.role}</td><td>${p.phone || ''}</td><td><button data-edit='${p.id}'>Bearbeiten</button></td></tr>`).join('');
  tbody.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => fillEmployeeForm(b.dataset.edit));
}

function fillEmployeeForm(id) {
  const p = profiles.find((x) => x.id === id);
  if (!p) return;
  const form = document.getElementById('employee-form');
  form.id.value = p.id;
  form.first_name.value = p.first_name || '';
  form.last_name.value = p.last_name || '';
  form.email.value = p.email || '';
  form.phone.value = p.phone || '';
  form.role.value = p.role;
  form.entry_date.value = p.entry_date || '';
  form.notes.value = p.notes || '';
}

async function bindEmployeeForm() {
  const form = document.getElementById('employee-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = form.id.value;
    if (!id) return showMessage('page-message', 'Mitarbeiter zuerst in Supabase Auth anlegen, dann Profil bearbeiten.', true);

    const payload = {
      first_name: form.first_name.value,
      last_name: form.last_name.value,
      email: form.email.value,
      phone: form.phone.value,
      role: form.role.value,
      entry_date: form.entry_date.value || null,
      notes: form.notes.value
    };

    const supabase = await getSupabase();
    const { error } = await supabase.from('profiles').update(payload).eq('id', id);
    if (error) return showMessage('page-message', error.message, true);
    await logActivity('employee_updated', `Mitarbeiter aktualisiert: ${payload.email}`);
    loadEmployees();
  });
}

async function loadEmployeeOptions() {
  const select = document.getElementById('doc_employee_id');
  select.innerHTML = '<option value="">Mitarbeiter wählen</option>' + profiles.map((p) => `<option value="${p.id}">${p.first_name || ''} ${p.last_name || ''} (${p.email})</option>`).join('');
}

async function bindDocuments() {
  const form = document.getElementById('employee-doc-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    const file = form.file.files[0];
    if (!file) return;
    const path = `${form.employee_id.value}/${Date.now()}-${file.name}`;
    const { error: upError } = await supabase.storage.from('employee-documents').upload(path, file);
    if (upError) return showMessage('page-message', upError.message, true);

    const payload = {
      employee_id: form.employee_id.value,
      title: form.title.value,
      document_type: form.document_type.value,
      expires_at: form.expires_at.value || null,
      file_path: path,
      note: form.note.value
    };
    const { error } = await supabase.from('employees_documents').insert([payload]);
    if (error) return showMessage('page-message', error.message, true);
    await logActivity('employee_document_uploaded', `Dokument hochgeladen: ${payload.title}`);
    form.reset();
    loadDocuments();
  });
}

async function loadDocuments() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('employees_documents').select('*, profiles(first_name,last_name,email)').order('expires_at', { ascending: true });
  if (error) return;
  const tbody = document.querySelector('#employee-docs-table tbody');
  tbody.innerHTML = data.map((d) => `<tr><td>${d.title}</td><td>${d.document_type}</td><td>${d.profiles?.email || ''}</td><td>${formatDate(d.expires_at)}</td><td>${d.file_path}</td></tr>`).join('');
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN] });
  if (!auth) return;
  await loadEmployees();
  await loadEmployeeOptions();
  await bindEmployeeForm();
  await bindDocuments();
  await loadDocuments();
})();
