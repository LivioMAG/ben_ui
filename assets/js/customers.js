import { initProtectedPage, logActivity, showMessage } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

async function loadCustomers() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
  if (error) return showMessage('page-message', error.message, true);

  const tbody = document.querySelector('#customers-table tbody');
  tbody.innerHTML = data.map((c) => `
    <tr>
      <td>${c.company_name}</td><td>${c.contact_person || ''}</td><td>${c.phone || ''}</td><td>${c.email || ''}</td>
      <td>
        <button data-edit='${JSON.stringify(c)}'>Bearbeiten</button>
        <button data-delete='${c.id}'>Löschen</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-delete]').forEach((btn) => btn.onclick = () => removeCustomer(btn.dataset.delete));
  tbody.querySelectorAll('[data-edit]').forEach((btn) => btn.onclick = () => fillForm(JSON.parse(btn.dataset.edit)));
}

function fillForm(c) {
  const form = document.getElementById('customer-form');
  form.id.value = c.id;
  form.company_name.value = c.company_name;
  form.contact_person.value = c.contact_person || '';
  form.phone.value = c.phone || '';
  form.email.value = c.email || '';
  form.address.value = c.address || '';
  form.notes.value = c.notes || '';
}

async function removeCustomer(id) {
  if (!confirm('Kunde wirklich löschen?')) return;
  const supabase = await getSupabase();
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) return showMessage('page-message', error.message, true);
  await logActivity('customer_deleted', `Kunde gelöscht: ${id}`);
  loadCustomers();
}

async function bindForm() {
  const form = document.getElementById('customer-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    const payload = {
      company_name: form.company_name.value,
      contact_person: form.contact_person.value,
      phone: form.phone.value,
      email: form.email.value,
      address: form.address.value,
      notes: form.notes.value
    };

    const id = form.id.value;
    const q = id
      ? supabase.from('customers').update(payload).eq('id', id)
      : supabase.from('customers').insert([payload]);

    const { error } = await q;
    if (error) return showMessage('page-message', error.message, true);
    await logActivity(id ? 'customer_updated' : 'customer_created', `Kunde ${payload.company_name}`);
    form.reset();
    form.id.value = '';
    loadCustomers();
  });
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN] });
  if (!auth) return;
  await bindForm();
  await loadCustomers();
})();
