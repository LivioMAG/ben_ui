import { initProtectedPage, formatDate } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

async function loadStats() {
  const supabase = await getSupabase();
  const [projects, customers, employees, openReports, openHours, expDocs, todaysPlanner, activities] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'aktiv'),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('site_reports').select('*', { count: 'exact', head: true }).in('status', ['entwurf', 'eingereicht']),
    supabase.from('time_entries').select('hours').eq('status', 'erfasst'),
    supabase.from('employees_documents').select('*').lte('expires_at', new Date(Date.now() + 30*86400000).toISOString().slice(0,10)),
    supabase.from('planner_entries').select('*, profiles(email), projects(project_title)').eq('entry_date', new Date().toISOString().slice(0,10)),
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10)
  ]);

  const openHoursSum = (openHours.data || []).reduce((s, item) => s + Number(item.hours || 0), 0);
  const stat = (id, val) => document.getElementById(id).textContent = val;
  stat('stat-active-projects', projects.count || 0);
  stat('stat-customers', customers.count || 0);
  stat('stat-employees', employees.count || 0);
  stat('stat-open-reports', openReports.count || 0);
  stat('stat-open-hours', openHoursSum.toFixed(2));
  stat('stat-expiring-docs', (expDocs.data || []).length);
  stat('stat-today-assignments', (todaysPlanner.data || []).length);

  document.querySelector('#activity-table tbody').innerHTML = (activities.data || []).map((a) => `<tr><td>${formatDate(a.created_at)}</td><td>${a.action_type}</td><td>${a.message}</td></tr>`).join('');
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN] });
  if (!auth) return;
  await loadStats();
})();
