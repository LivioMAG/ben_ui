import { logout, requireAuth } from './auth.js';
import { ROLES } from './roles.js';
import { getSupabase } from './supabase.js';

const NAV_ITEMS = [
  { href: '/dashboard.html', label: 'Dashboard', roles: [ROLES.ADMIN] },
  { href: '/customers.html', label: 'Kunden', roles: [ROLES.ADMIN] },
  { href: '/employees.html', label: 'Mitarbeiter', roles: [ROLES.ADMIN] },
  { href: '/projects.html', label: 'Projekte', roles: [ROLES.ADMIN] },
  { href: '/planner.html', label: 'Wochenplaner', roles: [ROLES.ADMIN] },
  { href: '/time-tracking.html', label: 'Stunden', roles: [ROLES.ADMIN, ROLES.EMPLOYEE] },
  { href: '/reports.html', label: 'Rapporte', roles: [ROLES.ADMIN, ROLES.EMPLOYEE] },
  { href: '/kanban.html', label: 'Kanban', roles: [ROLES.ADMIN] }
];

export async function initProtectedPage({ roles }) {
  const auth = await requireAuth(roles);
  if (!auth) return null;
  renderNavigation(auth.profile);
  setupLogout();
  const userEl = document.getElementById('current-user');
  if (userEl) userEl.textContent = `${auth.profile.first_name || ''} ${auth.profile.last_name || ''} (${auth.profile.role})`;
  return auth;
}

function renderNavigation(profile) {
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const currentPath = window.location.pathname;
  nav.innerHTML = NAV_ITEMS
    .filter((item) => item.roles.includes(profile.role))
    .map((item) => `<a class="${currentPath === item.href ? 'active' : ''}" href="${item.href}">${item.label}</a>`)
    .join('');
}

function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (!btn) return;
  btn.addEventListener('click', logout);
}

export function showMessage(elId, text, isError = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.className = isError ? 'msg error' : 'msg success';
}

export async function logActivity(actionType, message) {
  const supabase = await getSupabase();
  await supabase.from('activity_logs').insert([{ action_type: actionType, message }]);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-CH');
}
