function getLevel(streak) {
 if (streak <= 7) return "🌱 Beginner";
 if (streak <= 30) return "🔥 Consistent";
 if (streak <= 100) return "🚀 Champion";
 return "👑 Legend";
}

let tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

function save() {
 localStorage.setItem('tasks', JSON.stringify(tasks));
 render();
}

function today() {
 return new Date().toDateString();
}

// DOM refs
const titleEl = document.getElementById('title');
const categoryEl = document.getElementById("category");
const priorityEl = document.getElementById("priority");
const goalTypeEl = document.getElementById("goalType");
const targetDaysEl = document.getElementById("targetDays");

const themeBtn = document.getElementById("themeBtn");
const searchTask = document.getElementById("searchTask");

// ================= ADD TASK =================
document.getElementById('addBtn').onclick = () => {

 const title = titleEl.value.trim();
 const category = categoryEl.value;
 const priority = priorityEl.value;

 if (!title) return alert("Enter task name");
 if (!category) return alert("Select a category");
 if (!priority) return alert("Select a priority");

 if (goalTypeEl.value === "target") {
    const days = Number(targetDaysEl.value);
    if (!days || days <= 0) return alert("Enter valid target days");
 }

 tasks.push({
  id: Date.now(),
  title,
  category,
  priority,
  goalType: goalTypeEl.value,
  targetDays: goalTypeEl.value === "target" ? Number(targetDaysEl.value) : 0,
  currentStreak: 0,
  bestStreak: 0,
  totalCompleted: 0,
  lastCompleted: null,
  notes: []
 });

 titleEl.value = "";
 targetDaysEl.value = "";

 save();
 alert("✅ Goal Added Successfully");
};

// ================= THEME =================
function updateThemeButton() {
 themeBtn.textContent =
 document.body.classList.contains("dark")
 ? "☀️ Light Mode"
 : "🌙 Dark Mode";
}

themeBtn.onclick = () => {
 document.body.classList.toggle("dark");

 localStorage.setItem(
   "theme",
   document.body.classList.contains("dark") ? "dark" : "light"
 );

 updateThemeButton();
};

if (localStorage.getItem('theme') === 'dark') {
 document.body.classList.add('dark');
}
updateThemeButton();

// ================= GOAL TYPE =================
goalTypeEl.addEventListener("change", () => {
 targetDaysEl.style.display =
 goalTypeEl.value === "target" ? "block" : "none";
});
goalTypeEl.dispatchEvent(new Event("change"));

// ================= COMPLETE =================
function complete(id) {
 let t = tasks.find(x => x.id === id);
 if (!t) return;

 const tday = today();

 if (t.lastCompleted === tday) {
    return alert("Already completed today");
 }

 if (!t.lastCompleted) {
    t.currentStreak = 1;
 } else {
    const last = new Date(t.lastCompleted);
    const now = new Date(tday);
    const diff = Math.floor((now - last) / 86400000);

    t.currentStreak = (diff === 1) ? t.currentStreak + 1 : 1;
 }

 t.bestStreak = Math.max(t.bestStreak, t.currentStreak);
 t.totalCompleted++;
 t.lastCompleted = tday;

 save();
 alert("🎉 Great Job! Streak Updated!");
}

// ================= DELETE =================
function del(id) {
 tasks = tasks.filter(t => t.id !== id);
 save();
}

// ================= NOTES =================
function addNote(id) {
 let txt = document.getElementById('note-' + id).value.trim();
 if (!txt) return alert("Please enter a note");

 let t = tasks.find(x => x.id === id);
 if (!t) return;

 t.notes.push({ date: today(), text: txt });
 save();
}

// ================= RENDER =================
function render() {
 const wrap = document.getElementById('tasks');
 const emptyState = document.getElementById("emptyState");

 wrap.innerHTML = '';

 let done = 0;
 let longest = 0;

 const keyword = searchTask.value.toLowerCase();

 const filtered = tasks.filter(t =>
  t.title.toLowerCase().includes(keyword) ||
  t.category.toLowerCase().includes(keyword) ||
  t.priority.toLowerCase().includes(keyword)
 );

 filtered.forEach(t => {

  let progressValue = null;

  if (t.goalType === 'target' && t.targetDays > 0) {
    progressValue = Math.min(100, (t.currentStreak / t.targetDays) * 100);
  }

  if (t.lastCompleted === today()) done++;
  longest = Math.max(longest, t.bestStreak);

  let badge = "";
  if (t.goalType === "target" && t.currentStreak >= t.targetDays && t.targetDays > 0) {
    badge = `<p>🏆 Goal Completed</p>`;
  }

  const div = document.createElement('div');
  div.className = 'task';

  div.innerHTML = `
    <h3>${t.title}</h3>

    <p>${t.category} | ${t.priority}</p>

    <p>🔥 Current: ${t.currentStreak}</p>
    <p>🏆 Best: ${t.bestStreak}</p>
    <p>🚀 Level: ${getLevel(t.currentStreak)}</p>
    <p>✅ Total: ${t.totalCompleted}</p>

    <div class="progress">
      <div class="bar" style="width:${progressValue ?? 100}%"></div>
    </div>

    ${progressValue !== null ? `
      <p>Progress: ${progressValue.toFixed(0)}%</p>
    ` : `
      <p>♾ Unlimited Goal (No fixed target)</p>
    `}

    ${t.goalType === "target"
      ? `<p>🎯 Remaining: ${Math.max(0, t.targetDays - t.currentStreak)} days</p>`
      : `<p>♾ Unlimited Goal</p>`}

    ${badge}

    <div class="actions">
      <button class="complete-btn" onclick="complete(${t.id})">Complete Today</button>
      <button class="delete-btn" onclick="del(${t.id})">Delete</button>
    </div>

    <textarea id="note-${t.id}" placeholder="Daily note"></textarea>

    <button class="note-btn" onclick="addNote(${t.id})">Save Note</button>

    <p>📝 Notes: ${t.notes.length}</p>

    <div class="notes-list">
      ${t.notes.map(n => `<small>${n.date} - ${n.text}</small><br>`).join("")}
    </div>
  `;

  wrap.appendChild(div);
 });

 document.getElementById("totalTasks").textContent = tasks.length;
 document.getElementById("completedToday").textContent = done;
 document.getElementById("longestStreak").textContent = longest;

 emptyState.style.display = filtered.length === 0 ? "block" : "none";
}

searchTask.addEventListener("input", render);

// ================= IMPORT / EXPORT =================
document.getElementById('exportBtn').onclick = () => {
 const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
 const a = document.createElement('a');
 a.href = URL.createObjectURL(blob);
 a.download = 'streak-backup.json';
 a.click();
};

document.getElementById('importFile').onchange = (e) => {
 const file = e.target.files[0];
 if (!file) return;

 const r = new FileReader();

 r.onload = () => {
  tasks = JSON.parse(r.result);
  save();
  alert("✅ Backup Imported Successfully");
 };

 r.readAsText(file);
};

// ================= INIT =================
render();