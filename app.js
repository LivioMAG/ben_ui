const SECTIONS = [
  { id: "funnel", label: "Funnel", file: "funnel.json", description: "Fragen, Steps, Abschluss" },
  { id: "landing", label: "Landingpage", file: "landing.json", description: "Sektionen und Inhalte" },
  { id: "config", label: "Config", file: "config.json", description: "Theme, Tracking, Typografie" }
];

const storage = {
  namespace: "dashboard_dummy_supabase_v1",

  key(sectionId) {
    return `${this.namespace}:${sectionId}`;
  },

  async load(section) {
    const saved = localStorage.getItem(this.key(section.id));
    if (saved) return JSON.parse(saved);

    const response = await fetch(section.file);
    if (!response.ok) throw new Error(`Konnte ${section.file} nicht laden.`);
    return response.json();
  },

  async save(section, data) {
    const payload = {
      section: section.id,
      updatedAt: new Date().toISOString(),
      data
    };

    // Supabase-ready Struktur:
    // In Produktion payload z.B. via supabase.from('content').upsert(payload)
    // persistieren und danach per select() wieder laden.
    localStorage.setItem(this.key(section.id), JSON.stringify(payload.data));
    return payload;
  }
};

const state = {
  currentSection: SECTIONS[0],
  datasets: new Map(),
  defaults: new Map()
};

const drawerNav = document.getElementById("drawerNav");
const sectionTitle = document.getElementById("sectionTitle");
const editorRoot = document.getElementById("editorRoot");
const statusText = document.getElementById("statusText");
const saveBtn = document.getElementById("saveBtn");
const reloadBtn = document.getElementById("reloadBtn");

function deepClone(value) {
  return structuredClone(value);
}

function getDefaultFromTemplate(template) {
  if (Array.isArray(template)) {
    if (template.length === 0) return [];
    return [deepClone(template[0])];
  }

  if (template && typeof template === "object") {
    const result = {};
    Object.entries(template).forEach(([key, val]) => {
      result[key] = getDefaultFromTemplate(val);
    });
    return result;
  }

  if (typeof template === "string") return "";
  if (typeof template === "number") return 0;
  if (typeof template === "boolean") return false;
  return null;
}

function setStatus(message) {
  statusText.textContent = message;
}

function setPathValue(root, path, newValue) {
  let target = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    target = target[path[i]];
  }
  target[path[path.length - 1]] = newValue;
}

function getPathValue(root, path) {
  return path.reduce((acc, part) => acc[part], root);
}

function createPrimitiveField({ key, value, path, root }) {
  const template = document.getElementById("fieldTemplate");
  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector(".field-row");
  row.querySelector(".field-key").textContent = key;
  const controlWrap = row.querySelector(".field-control");

  let input;

  if (typeof value === "boolean") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    input.addEventListener("change", () => {
      setPathValue(root, path, input.checked);
    });
  } else if (typeof value === "number") {
    input = document.createElement("input");
    input.type = "number";
    input.value = value;
    input.addEventListener("input", () => {
      setPathValue(root, path, Number(input.value || 0));
    });
  } else {
    const isLong = typeof value === "string" && (value.includes("\n") || value.length > 90);
    input = document.createElement(isLong ? "textarea" : "input");
    if (!isLong) input.type = "text";
    input.value = value ?? "";
    input.addEventListener("input", () => {
      setPathValue(root, path, input.value);
    });
  }

  controlWrap.appendChild(input);
  return row;
}

function renderValue({ key, value, path, root, templateHint }) {
  const current = value;

  if (Array.isArray(current)) {
    const block = document.createElement("section");
    block.className = "block";
    block.innerHTML = `
      <div class="block-header">
        <div>
          <h4>${key}</h4>
          <p class="block-sub">Liste · Anzahl: ${current.length}</p>
        </div>
      </div>
    `;

    const stack = document.createElement("div");
    stack.className = "array-stack";

    current.forEach((entry, index) => {
      const itemWrap = document.createElement("article");
      itemWrap.className = "array-item";

      const controls = document.createElement("div");
      controls.className = "item-controls";
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn btn-danger";
      removeBtn.textContent = "Eintrag löschen";
      removeBtn.addEventListener("click", () => {
        const arr = getPathValue(root, path);
        arr.splice(index, 1);
        rerender();
      });
      controls.appendChild(removeBtn);
      itemWrap.appendChild(controls);

      if (entry && typeof entry === "object") {
        const child = renderObject({
          object: entry,
          path: [...path, index],
          root,
          title: `Eintrag ${index + 1}`,
          compact: true
        });
        itemWrap.appendChild(child);
      } else {
        itemWrap.appendChild(
          createPrimitiveField({
            key: `Wert ${index + 1}`,
            value: entry,
            path: [...path, index],
            root
          })
        );
      }

      stack.appendChild(itemWrap);
    });

    const actions = document.createElement("div");
    actions.className = "array-actions";
    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-ghost";
    addBtn.textContent = "Eintrag hinzufügen";
    addBtn.addEventListener("click", () => {
      const arr = getPathValue(root, path);
      const hint = current[0] ?? templateHint?.[0] ?? "";
      arr.push(getDefaultFromTemplate(hint));
      rerender();
    });
    actions.appendChild(addBtn);

    block.append(stack, actions);
    return block;
  }

  if (current && typeof current === "object") {
    return renderObject({ object: current, path, root, title: key });
  }

  return createPrimitiveField({ key, value: current, path, root });
}

function renderObject({ object, path, root, title, compact = false }) {
  const block = document.createElement("section");
  block.className = compact ? "" : "block";

  if (title) {
    const header = document.createElement("div");
    header.className = "block-header";
    header.innerHTML = `<div><h3>${title}</h3></div>`;
    block.appendChild(header);
  }

  Object.entries(object).forEach(([key, value]) => {
    const defaultRoot = state.defaults.get(state.currentSection.id);
    const templateHint = path.length
      ? getPathValue(defaultRoot, [...path, key])
      : defaultRoot?.[key];

    const node = renderValue({
      key,
      value,
      path: [...path, key],
      root,
      templateHint
    });
    block.appendChild(node);
  });

  return block;
}

function rerender() {
  editorRoot.innerHTML = "";
  const data = state.datasets.get(state.currentSection.id);
  if (!data) return;
  const tree = renderObject({
    object: data,
    path: [],
    root: data,
    title: `${state.currentSection.label} JSON`
  });
  editorRoot.appendChild(tree);
}

function renderNav() {
  drawerNav.innerHTML = "";
  SECTIONS.forEach((section) => {
    const btn = document.createElement("button");
    btn.className = `nav-item ${section.id === state.currentSection.id ? "active" : ""}`;
    btn.innerHTML = `<p>${section.id.toUpperCase()}</p><h3>${section.label}</h3><p>${section.description}</p>`;
    btn.addEventListener("click", () => {
      state.currentSection = section;
      sectionTitle.textContent = section.label;
      renderNav();
      rerender();
      setStatus(`${section.label} geladen. Alle Values sind editierbar, Keys bleiben fix.`);
    });
    drawerNav.appendChild(btn);
  });
}

async function bootstrap() {
  setStatus("Lade JSON-Dateien...");

  await Promise.all(
    SECTIONS.map(async (section) => {
      const dataset = await storage.load(section);
      state.datasets.set(section.id, dataset);
      state.defaults.set(section.id, deepClone(dataset));
    })
  );

  sectionTitle.textContent = state.currentSection.label;
  renderNav();
  rerender();
  setStatus("Bereit. Änderungen können gespeichert und wieder geladen werden (Dummy-Supabase via localStorage).");
}

saveBtn.addEventListener("click", async () => {
  const data = state.datasets.get(state.currentSection.id);
  const payload = await storage.save(state.currentSection, data);
  setStatus(`Gespeichert: ${state.currentSection.label} · ${new Date(payload.updatedAt).toLocaleString("de-CH")}`);
});

reloadBtn.addEventListener("click", async () => {
  const section = state.currentSection;
  const fresh = await storage.load(section);
  state.datasets.set(section.id, fresh);
  rerender();
  setStatus(`${section.label} neu geladen (simuliert aus Supabase/localStorage).`);
});

bootstrap().catch((err) => {
  console.error(err);
  setStatus(`Fehler: ${err.message}`);
});
