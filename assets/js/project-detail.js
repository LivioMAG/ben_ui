import { initProtectedPage, logActivity, showMessage, formatDate } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

function getProjectId() {
  return new URLSearchParams(window.location.search).get('id');
}

async function loadProject() {
  const id = getProjectId();
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('projects').select('*, customers(company_name)').eq('id', id).single();
  if (error) return showMessage('page-message', error.message, true);
  document.getElementById('project-title').textContent = data.project_title;
  document.getElementById('project-meta').textContent = `${data.customers?.company_name || ''} | ${data.site_name || ''} | ${data.status} | ${formatDate(data.start_date)} - ${formatDate(data.end_date)}`;
}

async function bindFileUpload() {
  const form = document.getElementById('project-file-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = getProjectId();
    const supabase = await getSupabase();
    const file = form.file.files[0];
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: upError } = await supabase.storage.from('project-files').upload(path, file);
    if (upError) return showMessage('page-message', upError.message, true);
    const payload = { project_id: id, category: form.category.value, title: form.title.value, file_path: path };
    const { error } = await supabase.from('project_files').insert([payload]);
    if (error) return showMessage('page-message', error.message, true);
    await logActivity('project_file_uploaded', `Datei hochgeladen: ${payload.title}`);
    form.reset();
    loadFiles();
  });
}

async function loadFiles() {
  const supabase = await getSupabase();
  const id = getProjectId();
  const { data } = await supabase.from('project_files').select('*').eq('project_id', id).order('created_at', { ascending: false });
  const tbody = document.querySelector('#files-table tbody');
  tbody.innerHTML = (data || []).map((f) => `<tr><td>${f.title}</td><td>${f.category}</td><td>${f.file_path}</td><td><button data-del='${f.id}'>Löschen</button></td></tr>`).join('');
  tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => removeFile(b.dataset.del));
}

async function removeFile(id) {
  const supabase = await getSupabase();
  await supabase.from('project_files').delete().eq('id', id);
  loadFiles();
}

async function bindPhotoUpload() {
  const form = document.getElementById('project-photo-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = getProjectId();
    const supabase = await getSupabase();
    const file = form.photo.files[0];
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: upError } = await supabase.storage.from('project-photos').upload(path, file);
    if (upError) return showMessage('page-message', upError.message, true);
    const payload = { project_id: id, category: form.category.value, title: form.title.value, description: form.description.value, file_path: path };
    await supabase.from('project_photos').insert([payload]);
    form.reset();
    loadPhotos();
  });
}

async function loadPhotos() {
  const supabase = await getSupabase();
  const id = getProjectId();
  const { data } = await supabase.from('project_photos').select('*').eq('project_id', id).order('created_at', { ascending: false });
  const box = document.getElementById('photos-grid');
  box.innerHTML = (data || []).map((p) => `<article class='card'><h4>${p.title}</h4><p>${p.category}</p><small>${p.file_path}</small></article>`).join('');
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN] });
  if (!auth) return;
  await loadProject();
  await bindFileUpload();
  await bindPhotoUpload();
  await loadFiles();
  await loadPhotos();
})();
