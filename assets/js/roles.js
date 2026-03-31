import { getSupabase } from './supabase.js';

export const ROLES = {
  ADMIN: 'admin',
  EMPLOYEE: 'mitarbeiter'
};

export async function getCurrentProfile() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

export function hasRole(profile, allowedRoles = []) {
  if (!profile) return false;
  return allowedRoles.includes(profile.role);
}

export function canAccessAdmin(profile) {
  return hasRole(profile, [ROLES.ADMIN]);
}

export function canAccessEmployee(profile) {
  return hasRole(profile, [ROLES.ADMIN, ROLES.EMPLOYEE]);
}
