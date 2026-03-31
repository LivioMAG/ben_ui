import { initProtectedPage, showMessage } from './app.js';
import { getSupabase } from './supabase.js';
import { ROLES } from './roles.js';

let boardId = null;

async function ensureBoard() {
  const supabase = await getSupabase();
  const { data } = await supabase.from('kanban_boards').select('*').limit(1).maybeSingle();
  if (data) { boardId = data.id; return; }
  const { data: inserted } = await supabase.from('kanban_boards').insert([{ name: 'Internes Board' }]).select().single();
  boardId = inserted.id;
}

async function loadColumns() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('kanban_columns').select('*, kanban_cards(*)').eq('board_id', boardId).order('position');
  if (error) return showMessage('page-message', error.message, true);
  const wrapper = document.getElementById('kanban-columns');
  wrapper.innerHTML = data.map((c) => `
    <section class='kanban-column' data-column='${c.id}'>
      <h3>${c.title}</h3>
      <div class='cards'>${(c.kanban_cards || []).sort((a,b)=>a.position-b.position).map((card) => `
        <article draggable='true' class='kanban-card' data-card='${card.id}'>
          <strong>${card.title}</strong><p>${card.description || ''}</p>
        </article>
      `).join('')}</div>
      <form class='card-form'><input name='title' placeholder='Titel' required><input name='description' placeholder='Beschreibung'><button>+</button></form>
    </section>
  `).join('');
  setupDnD();
  wrapper.querySelectorAll('.card-form').forEach((f) => {
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const columnId = f.closest('.kanban-column').dataset.column;
      const payload = { column_id: columnId, title: f.title.value, description: f.description.value, position: Date.now() };
      await supabase.from('kanban_cards').insert([payload]);
      f.reset();
      loadColumns();
    });
  });
}

function setupDnD() {
  const cards = document.querySelectorAll('.kanban-card');
  const columns = document.querySelectorAll('.kanban-column .cards');
  cards.forEach((card) => {
    card.addEventListener('dragstart', () => card.classList.add('dragging'));
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  columns.forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (dragging) col.appendChild(dragging);
    });
    col.addEventListener('drop', async () => {
      const supabase = await getSupabase();
      const dragging = col.querySelector('.dragging');
      if (!dragging) return;
      const cardId = dragging.dataset.card;
      const columnId = col.closest('.kanban-column').dataset.column;
      await supabase.from('kanban_cards').update({ column_id: columnId, position: Date.now() }).eq('id', cardId);
      loadColumns();
    });
  });
}

async function bindColumnForm() {
  const form = document.getElementById('column-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supabase = await getSupabase();
    await supabase.from('kanban_columns').insert([{ board_id: boardId, title: form.title.value, position: Date.now() }]);
    form.reset();
    loadColumns();
  });
}

(async function init() {
  const auth = await initProtectedPage({ roles: [ROLES.ADMIN] });
  if (!auth) return;
  await ensureBoard();
  await bindColumnForm();
  await loadColumns();
})();
