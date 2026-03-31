const STORAGE_KEY = "dispo_demo_data_v1";
const TEAM = [
  "Lena", "Noah", "Mia", "Luca", "Sofia",
  "Jonas", "Nina", "Tim", "Lea", "Ben"
];

const DAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const fakeSeed = {
  weekOffset: 0,
  tasks: [
    { day: "Montag", start: "08:00", end: "10:30", person: "Lena", project: "Neubau Kita", activity: "Materialdisposition" },
    { day: "Montag", start: "10:30", end: "13:00", person: "Noah", project: "Service 24/7", activity: "Kunden-Support" },
    { day: "Dienstag", start: "09:00", end: "12:00", person: "Mia", project: "Umbau Büro", activity: "Planung Elektro" },
    { day: "Mittwoch", start: "13:00", end: "17:00", person: "Luca", project: "Hotel Refit", activity: "Baustellenkoordination" },
    { day: "Freitag", start: "07:00", end: "11:00", person: "Ben", project: "Logistik", activity: "Auslieferung" }
  ],
  absences: [
    { person: "Sofia", type: "Ferien", from: "2026-04-01", to: "2026-04-04" },
    { person: "Jonas", type: "Krankheit", from: "2026-03-31", to: "2026-04-02" },
    { person: "Nina", type: "Militär", from: "2026-04-06", to: "2026-04-10" }
  ]
};

const state = loadData();

const taskForm = document.getElementById("taskForm");
const absenceForm = document.getElementById("absenceForm");
const taskBody = document.getElementById("taskTableBody");
const absenceChips = document.getElementById("absenceChips");
const daySelect = document.getElementById("daySelect");
const statsList = document.getElementById("statsList");
const weekLabel = document.getElementById("weekLabel");

init();

function init() {
  populateTeamSelects();
  populateDaySelect();
  wireEvents();
  render();
}

function wireEvents() {
  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(taskForm);
    const task = Object.fromEntries(data.entries());

    if (task.start >= task.end) {
      alert("Die Startzeit muss vor der Endzeit liegen.");
      return;
    }

    state.tasks.push(task);
    persist();
    taskForm.reset();
    render();
  });

  absenceForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(absenceForm);
    const absence = Object.fromEntries(data.entries());

    if (absence.from > absence.to) {
      alert("Das Von-Datum muss vor dem Bis-Datum liegen.");
      return;
    }

    state.absences.push(absence);
    persist();
    absenceForm.reset();
    render();
  });

  document.getElementById("prevWeek").addEventListener("click", () => {
    state.weekOffset -= 1;
    persist();
    render();
  });

  document.getElementById("nextWeek").addEventListener("click", () => {
    state.weekOffset += 1;
    persist();
    render();
  });
}

function render() {
  renderWeekLabel();
  renderTasks();
  renderAbsences();
  renderStats();
}

function renderTasks() {
  const rows = [...state.tasks].sort(sortByDayThenTime).map((t) => `
    <tr>
      <td>${t.day}</td>
      <td>${t.start}–${t.end}</td>
      <td>${t.person}</td>
      <td>${t.project}</td>
      <td>${t.activity}</td>
    </tr>`).join("");

  taskBody.innerHTML = rows || `<tr><td colspan="5">Noch keine Aufgaben erfasst.</td></tr>`;
}

function renderAbsences() {
  absenceChips.innerHTML = state.absences
    .map((a) => `<span class="chip">${a.person}: ${a.type} (${a.from} bis ${a.to})</span>`)
    .join("") || "<span>Keine Absenzen erfasst.</span>";
}

function renderStats() {
  const todaysTasks = state.tasks.filter((t) => t.day === DAY_NAMES[new Date().getDay() - 1]).length;
  const uniquePeopleOnDuty = new Set(state.tasks.map((t) => t.person)).size;

  statsList.innerHTML = `
    <li><strong>${TEAM.length}</strong> Mitarbeitende</li>
    <li><strong>${state.tasks.length}</strong> Aufgaben geplant</li>
    <li><strong>${state.absences.length}</strong> Absenzen erfasst</li>
    <li><strong>${uniquePeopleOnDuty}</strong> Personen disponiert</li>
    <li><strong>${Math.max(todaysTasks, 0)}</strong> Einsätze heute</li>
  `;
}

function renderWeekLabel() {
  const date = new Date();
  date.setDate(date.getDate() + state.weekOffset * 7);

  const week = isoWeek(date);
  const year = date.getFullYear();
  weekLabel.textContent = `KW ${week} · ${year}`;
}

function populateTeamSelects() {
  const taskSelect = document.getElementById("personTaskSelect");
  const absSelect = document.getElementById("personAbsenceSelect");

  const options = TEAM.map((name) => `<option>${name}</option>`).join("");
  taskSelect.innerHTML = options;
  absSelect.innerHTML = options;
}

function populateDaySelect() {
  daySelect.innerHTML = DAY_NAMES.map((d) => `<option>${d}</option>`).join("");
}

function sortByDayThenTime(a, b) {
  const dayDiff = DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day);
  if (dayDiff !== 0) return dayDiff;
  return a.start.localeCompare(b.start);
}

function loadData() {
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (!fromStorage) return structuredClone(fakeSeed);

  try {
    return JSON.parse(fromStorage);
  } catch {
    return structuredClone(fakeSeed);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
