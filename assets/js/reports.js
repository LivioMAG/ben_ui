import { initProtectedPage, showMessage } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

let currentProfile;

function getKw(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

async function loadOptions() {
  const supabase = await getSupabase();
  const { data: projects } = await supabase.from('projects').select('id,project_title').order('project_title');
  document.getElementById('report_project_id').innerHTML = projects.map((p) => `<option value='${p.id}'>${p.project_title}</option>`).join('');

  const empSelect = document.getElementById('report_employee_id');
  if (currentProfile.role === ROLES.ADMIN) {
    const { data: employees } = await supabase.from('profiles').select('id,email').order('email');
    empSelect.innerHTML = employees.map((e) => `<option value='${e.id}'>${e.email}</option>`).join('');
  } else {
    empSelect.innerHTML = `<option value='${currentProfile.id}'>${currentProfile.email}</option>`;
    empSelect.disabled = true;
  }
}

async function loadReports() {
  const supabase = await getSupabase();
  let q = supabase.from('site_reports').select('*, projects(project_title), profiles(email)').order('report_date', { ascending: false });
  if (currentProfile.role === ROLES.EMPLOYEE) q = q.eq('employee_id', currentProfile.id);
  const { data, error } = await q;
  if (error) return showMessage('page-message', error.message, true);
  document.querySelector('#reports-table tbody').innerHTML = data.map((r) => `<tr><td>${r.report_date}</td><td>${r.profiles?.email || ''}</td><td>${r.projects?.project_title || ''}</td><td>${r.status}</td><td>${r.hours || ''}</td></tr>`).join('');
}

async function bindReportForm() {
  const form = document.getElementById('report-form');
  form.report_date.addEventListener('change', () => form.calendar_week.value = getKw(form.report_date.value));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    const payload = {
      employee_id: currentProfile.role === ROLES.EMPLOYEE ? currentProfile.id : form.employee_id.value,
      project_id: form.project_id.value,
      report_date: form.report_date.value,
      calendar_week: Number(form.calendar_week.value),
      work_description: form.work_description.value,
      used_material: form.used_material.value,
      special_incidents: form.special_incidents.value,
      hours: form.hours.value ? Number(form.hours.value) : null,
      status: form.status.value
    };
    const { data, error } = await supabase.from('site_reports').insert([payload]).select().single();
    if (error) return showMessage('page-message', error.message, true);

    const files = form.photos.files;
    for (const file of files) {
      const path = `${data.id}/${Date.now()}-${file.name}`;
      await supabase.storage.from('report-photos').upload(path, file);
      await supabase.from('site_report_photos').insert([{ report_id: data.id, file_path: path, title: file.name }]);
    }

    form.reset();
    loadReports();
  });
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN, ROLES.EMPLOYEE] });
  if (!auth) return;
  currentProfile = auth.profile;
  await loadOptions();
  await bindReportForm();
  await loadReports();
})();
