import { getSupabase } from './supabase.js';
import { getCurrentProfile, ROLES } from './roles.js';

export async function requireAuth(allowedRoles = [ROLES.ADMIN, ROLES.EMPLOYEE]) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login.html';
    return null;
  }

  const profile = await getCurrentProfile();
  if (!profile || !allowedRoles.includes(profile.role)) {
    window.location.href = '/index.html';
    return null;
  }
  return { session, profile };
}

export async function logout() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}

async function handleLoginForm() {
  const supabase = await getSupabase();
  const form = document.getElementById('login-form');
  const msg = document.getElementById('auth-message');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const email = form.email.value.trim();
    const password = form.password.value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      msg.textContent = error.message;
      return;
    }

    const profile = await getCurrentProfile();
    window.location.href = profile?.role === ROLES.ADMIN ? '/dashboard.html' : '/reports.html';
  });
}

async function handleResetForm() {
  const supabase = await getSupabase();
  const btn = document.getElementById('reset-password-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const email = document.getElementById('reset-email').value.trim();
    const msg = document.getElementById('auth-message');
    if (!email) {
      msg.textContent = 'Bitte E-Mail eingeben.';
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login.html`
    });
    msg.textContent = error ? error.message : 'Reset-Link wurde per E-Mail gesendet.';
  });
}

async function handleOtpForm() {
  const supabase = await getSupabase();
  const sendBtn = document.getElementById('send-otp-btn');
  const verifyForm = document.getElementById('otp-verify-form');
  if (!sendBtn || !verifyForm) return;

  sendBtn.addEventListener('click', async () => {
    const email = document.getElementById('otp-email').value.trim();
    const msg = document.getElementById('auth-message');
    const { error } = await supabase.auth.signInWithOtp({ email });
    msg.textContent = error ? error.message : 'OTP-Code wurde per E-Mail gesendet.';
  });

  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('otp-email').value.trim();
    const token = document.getElementById('otp-token').value.trim();
    const msg = document.getElementById('auth-message');

    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      msg.textContent = error.message;
      return;
    }

    const profile = await getCurrentProfile();
    window.location.href = profile?.role === ROLES.ADMIN ? '/dashboard.html' : '/reports.html';
  });
}

export async function initLoginPage() {
  await handleLoginForm();
  await handleResetForm();
  await handleOtpForm();
}
