// Streak Tracker Pro - Version 1.1.0
// Features: Habit tracking, Target & Unlimited goals, Streaks, Notes, Dark/Light Mode,
// Search, Backup/Restore, Offline PWA & Scheduled Background Push Notifications

// ================= GLOBAL CONFIG & TIMEZONE =================
const USER_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch (e) {
    return 'Asia/Kolkata';
  }
})();

// Default fallback VAPID key (matches generated backend key)
const FALLBACK_VAPID_PUBLIC_KEY = 'BN72HLtQfYH-gyzLSJURTEBhbfNlm6gd5mQGsGJQ171LBbj4jXY3wMT30Yn7UQl4_Jyv7IaodoulkFA3jreNBgM';

let swRegistration = null;
let currentPushSubscription = null;

// ================= TASK MIGRATION & LOCAL STORAGE =================
function normalizeTask(t) {
  return {
    id: t.id || Date.now(),
    title: t.title || "Untitled Goal",
    category: t.category || "Other",
    priority: t.priority || "Medium",
    goalType: t.goalType || "unlimited",
    targetDays: Number(t.targetDays) || 0,
    currentStreak: Number(t.currentStreak) || 0,
    bestStreak: Number(t.bestStreak) || 0,
    totalCompleted: Number(t.totalCompleted) || 0,
    lastCompleted: t.lastCompleted || null,
    notes: Array.isArray(t.notes) ? t.notes : [],
    // New reminder fields with safe defaults
    notificationEnabled: Boolean(t.notificationEnabled),
    reminderTime: t.reminderTime || "19:00",
    timezone: t.timezone || USER_TIMEZONE,
    lastReminderSent: t.lastReminderSent || null
  };
}

let tasks = [];
try {
  const raw = localStorage.getItem('tasks');
  const parsed = raw ? JSON.parse(raw) : [];
  tasks = Array.isArray(parsed) ? parsed.map(normalizeTask) : [];
} catch (e) {
  console.warn("Error loading tasks from localStorage, initializing empty list", e);
  tasks = [];
}

function save() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
  render();
}

function today() {
  return new Date().toDateString();
}

function getLevel(streak) {
  if (streak <= 7) return "🌱 Beginner";
  if (streak <= 30) return "🔥 Consistent";
  if (streak <= 100) return "🚀 Champion";
  return "👑 Legend";
}

function formatTime12H(time24) {
  if (!time24) return "7:00 PM";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Convert Base64 URL to Uint8Array for PushManager
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ================= DOM REFS =================
const titleEl = document.getElementById('title');
const categoryEl = document.getElementById("category");
const priorityEl = document.getElementById("priority");
const goalTypeEl = document.getElementById("goalType");
const targetDaysEl = document.getElementById("targetDays");
const enableReminderEl = document.getElementById("enableReminder");
const reminderTimeEl = document.getElementById("reminderTime");
const reminderTimeGroup = document.getElementById("reminderTimeGroup");
const detectedTzEl = document.getElementById("detectedTz");

const themeBtn = document.getElementById("themeBtn");
const notifStatusBtn = document.getElementById("notifStatusBtn");
const testPushBtn = document.getElementById("testPushBtn");
const notifBanner = document.getElementById("notifBanner");
const searchTask = document.getElementById("searchTask");

if (detectedTzEl) {
  detectedTzEl.textContent = `Timezone: ${USER_TIMEZONE}`;
}

// ================= NOTIFICATION BANNER HELPER =================
function showBanner(message, type = 'info', autoDismiss = 6000) {
  if (!notifBanner) return;
  notifBanner.className = `notif-banner ${type}`;
  notifBanner.innerHTML = `
    <span>${message}</span>
    <button class="banner-close-btn" onclick="document.getElementById('notifBanner').style.display='none'">&times;</button>
  `;
  notifBanner.style.display = 'flex';

  if (autoDismiss > 0) {
    setTimeout(() => {
      if (notifBanner) notifBanner.style.display = 'none';
    }, autoDismiss);
  }
}

// ================= PWA & PUSH NOTIFICATIONS =================
async function getVapidPublicKey() {
  try {
    const res = await fetch('/.netlify/functions/vapid-public-key');
    if (res.ok) {
      const data = await res.json();
      if (data.publicKey) return data.publicKey;
    }
  } catch (e) {
    console.log('[Push] Netlify function unavailable, using local key');
  }
  return FALLBACK_VAPID_PUBLIC_KEY;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers not supported in this browser.');
    updateNotificationStatusUI('unsupported');
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[PWA] Service Worker registered with scope:', reg.scope);
    swRegistration = reg;

    // Check existing push subscription
    if ('PushManager' in window) {
      currentPushSubscription = await reg.pushManager.getSubscription();
      if (currentPushSubscription) {
        console.log('[Push] Active push subscription restored.');
        updateNotificationStatusUI('granted');
      } else {
        updateNotificationStatusUI(Notification.permission);
      }
    }

    return reg;
  } catch (err) {
    console.error('[PWA] Service Worker registration failed:', err);
    updateNotificationStatusUI('error');
    return null;
  }
}

function updateNotificationStatusUI(status) {
  if (!notifStatusBtn) return;

  if (status === 'granted' || currentPushSubscription) {
    notifStatusBtn.textContent = "🔔 Notifications: Enabled";
    notifStatusBtn.className = "notif-btn active";
  } else if (status === 'denied') {
    notifStatusBtn.textContent = "🔕 Notifications: Blocked";
    notifStatusBtn.className = "notif-btn disabled";
  } else if (status === 'unsupported') {
    notifStatusBtn.textContent = "⚠️ Notifications Unsupported";
    notifStatusBtn.className = "notif-btn disabled";
  } else {
    notifStatusBtn.textContent = "🔔 Enable Notifications";
    notifStatusBtn.className = "notif-btn";
  }
}

async function requestPushSubscription() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    showBanner("Push notifications are not supported by your current browser.", "warning");
    return null;
  }

  if (Notification.permission === 'denied') {
    showBanner("Notifications are blocked. Please enable notifications in your browser settings to receive reminders.", "warning", 10000);
    updateNotificationStatusUI('denied');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showBanner("Notifications are blocked. Please enable notifications in your browser settings to receive reminders.", "warning", 10000);
      updateNotificationStatusUI('denied');
      return null;
    }

    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.ready;
    }

    let sub = await swRegistration.pushManager.getSubscription();
    if (!sub) {
      const publicKey = await getVapidPublicKey();
      sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey)
      });
    }

    currentPushSubscription = sub;
    updateNotificationStatusUI('granted');
    showBanner("✅ Notifications successfully enabled! Your background reminders are active.", "success");
    return sub;
  } catch (err) {
    console.error("[Push] Subscription error:", err);
    showBanner("Failed to subscribe for push notifications: " + err.message, "warning");
    return null;
  }
}

// Sync task reminder with backend database
async function syncReminderWithBackend(task) {
  if (!task.notificationEnabled) return;

  try {
    let sub = currentPushSubscription;
    if (!sub && swRegistration) {
      sub = await swRegistration.pushManager.getSubscription();
      currentPushSubscription = sub;
    }

    if (!sub) {
      sub = await requestPushSubscription();
    }

    if (!sub) {
      console.warn('[Push] Cannot sync reminder without push subscription');
      return;
    }

    const payload = {
      taskId: task.id,
      title: task.title,
      category: task.category,
      priority: task.priority,
      goalType: task.goalType,
      targetDays: task.targetDays,
      currentStreak: task.currentStreak,
      lastCompleted: task.lastCompleted,
      reminderEnabled: task.notificationEnabled,
      reminderTime: task.reminderTime,
      timezone: task.timezone || USER_TIMEZONE,
      subscription: sub.toJSON()
    };

    const res = await fetch('/.netlify/functions/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`[Push] Reminder for "${task.title}" synced to backend successfully.`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.warn('[Push] Backend sync returned status:', res.status, data);
    }
  } catch (err) {
    console.warn('[Push] Backend sync error (app continues working offline):', err);
  }
}

// Sync completion state to backend to prevent sending reminder today
async function syncCompletionWithBackend(taskId, lastCompleted, currentStreak) {
  try {
    await fetch('/.netlify/functions/sync-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        lastCompleted,
        currentStreak,
        endpoint: currentPushSubscription ? currentPushSubscription.endpoint : null
      })
    });
  } catch (e) {
    console.warn('[Push] Error syncing completion with backend:', e);
  }
}

// Delete reminder from backend database
async function deleteReminderFromBackend(taskId) {
  try {
    await fetch('/.netlify/functions/delete-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        endpoint: currentPushSubscription ? currentPushSubscription.endpoint : null
      })
    });
  } catch (e) {
    console.warn('[Push] Error deleting reminder from backend:', e);
  }
}

// ================= THEME TOGGLE =================
function updateThemeButton() {
  themeBtn.textContent = document.body.classList.contains("dark")
    ? "☀️ Light Mode"
    : "🌙 Dark Mode";
}

themeBtn.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  updateThemeButton();
};

if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
}
updateThemeButton();

// ================= GOAL TYPE & REMINDER TOGGLES =================
goalTypeEl.addEventListener("change", () => {
  targetDaysEl.style.display = goalTypeEl.value === "target" ? "block" : "none";
});
goalTypeEl.dispatchEvent(new Event("change"));

enableReminderEl.addEventListener("change", () => {
  reminderTimeGroup.style.display = enableReminderEl.checked ? "flex" : "none";
  if (enableReminderEl.checked && Notification.permission !== 'granted') {
    requestPushSubscription();
  }
});

// ================= ADD TASK =================
document.getElementById('addBtn').onclick = async () => {
  const title = titleEl.value.trim();
  const category = categoryEl.value;
  const priority = priorityEl.value;
  const goalType = goalTypeEl.value;
  const isTarget = goalType === "target";

  if (!title) return alert("Enter task name");
  if (!category) return alert("Select a category");
  if (!priority) return alert("Select a priority");

  if (isTarget) {
    const days = Number(targetDaysEl.value);
    if (!days || days <= 0) return alert("Enter valid target days");
  }

  const notificationEnabled = Boolean(enableReminderEl.checked);
  const reminderTime = reminderTimeEl.value || "19:00";

  const newTask = {
    id: Date.now(),
    title,
    category,
    priority,
    goalType,
    targetDays: isTarget ? Number(targetDaysEl.value) : 0,
    currentStreak: 0,
    bestStreak: 0,
    totalCompleted: 0,
    lastCompleted: null,
    notes: [],
    notificationEnabled,
    reminderTime,
    timezone: USER_TIMEZONE,
    lastReminderSent: null
  };

  tasks.push(newTask);
  save();

  // Reset form inputs
  titleEl.value = "";
  targetDaysEl.value = "";
  enableReminderEl.checked = false;
  reminderTimeGroup.style.display = "none";

  alert("✅ Goal Added Successfully");

  // If reminder was enabled, ensure permission & sync to backend
  if (notificationEnabled) {
    await syncReminderWithBackend(newTask);
  }
};

// ================= COMPLETE TASK =================
async function complete(id) {
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

  // Notify backend so scheduler knows task was completed today and avoids sending reminders!
  if (t.notificationEnabled) {
    syncCompletionWithBackend(t.id, tday, t.currentStreak);
  }
}

// ================= DELETE TASK =================
async function del(id) {
  const taskToDelete = tasks.find(t => t.id === id);
  if (taskToDelete && taskToDelete.notificationEnabled) {
    deleteReminderFromBackend(id);
  }

  tasks = tasks.filter(t => t.id !== id);
  save();
}

// ================= NOTES =================
function addNote(id) {
  let noteInput = document.getElementById('note-' + id);
  if (!noteInput) return;
  let txt = noteInput.value.trim();
  if (!txt) return alert("Please enter a note");

  let t = tasks.find(x => x.id === id);
  if (!t) return;

  t.notes.push({ date: today(), text: txt });
  noteInput.value = "";
  save();
}

// ================= INLINE REMINDER EDITING =================
function toggleEditReminder(id) {
  const box = document.getElementById(`edit-reminder-${id}`);
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function saveReminderSettings(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  const enabledInput = document.getElementById(`edit-rem-enabled-${id}`);
  const timeInput = document.getElementById(`edit-rem-time-${id}`);

  const wasEnabled = t.notificationEnabled;
  t.notificationEnabled = enabledInput ? enabledInput.checked : false;
  t.reminderTime = (timeInput && timeInput.value) ? timeInput.value : (t.reminderTime || "19:00");
  t.timezone = USER_TIMEZONE;

  save();

  if (t.notificationEnabled) {
    if (Notification.permission !== 'granted') {
      await requestPushSubscription();
    }
    await syncReminderWithBackend(t);
    showBanner(`🔔 Reminder set for "${t.title}" at ${formatTime12H(t.reminderTime)}`, "success");
  } else if (wasEnabled) {
    await deleteReminderFromBackend(t.id);
    showBanner(`🔕 Reminder disabled for "${t.title}"`, "info");
  }
}

// ================= RENDER =================
function render() {
  const wrap = document.getElementById('tasks');
  const emptyState = document.getElementById("emptyState");

  wrap.innerHTML = '';

  let done = 0;
  let longest = 0;

  const keyword = (searchTask.value || "").toLowerCase();

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

    // Reminder status pill
    const reminderPillHtml = t.notificationEnabled
      ? `<span class="reminder-pill on">🔔 Reminder: ON (⏰ ${formatTime12H(t.reminderTime)})</span>`
      : `<span class="reminder-pill off">🔕 Reminder: OFF</span>`;

    const div = document.createElement('div');
    div.className = 'task';

    div.innerHTML = `
      <h3>${escapeHtml(t.title)}</h3>

      <p>${escapeHtml(t.category)} | ${escapeHtml(t.priority)}</p>

      <div style="margin: 6px 0;">
        ${reminderPillHtml}
      </div>

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
        <button class="reminder-btn" onclick="toggleEditReminder(${t.id})">⏰ Edit Reminder</button>
        <button class="delete-btn" onclick="del(${t.id})">Delete</button>
      </div>

      <!-- INLINE REMINDER EDITOR -->
      <div id="edit-reminder-${t.id}" class="edit-reminder-box" style="display: none;">
        <h4>⏰ Scheduled Reminder Settings</h4>
        <div class="edit-reminder-row">
          <label class="checkbox-label">
            <input type="checkbox" id="edit-rem-enabled-${t.id}" ${t.notificationEnabled ? 'checked' : ''}>
            <span>Enable Reminder</span>
          </label>
          <input type="time" id="edit-rem-time-${t.id}" value="${t.reminderTime || '19:00'}">
          <button class="save-rem-btn" onclick="saveReminderSettings(${t.id})">Save</button>
          <button class="cancel-rem-btn" onclick="toggleEditReminder(${t.id})">Cancel</button>
        </div>
        <small style="opacity: 0.8; display: block; margin-top: 6px;">Reminders fire even when the site is closed (${USER_TIMEZONE}).</small>
      </div>

      <textarea id="note-${t.id}" placeholder="Daily note"></textarea>

      <button class="note-btn" onclick="addNote(${t.id})">Save Note</button>

      <p>📝 Notes: ${t.notes.length}</p>

      <div class="notes-list">
        ${t.notes.map(n => `<small>${escapeHtml(n.date)} - ${escapeHtml(n.text)}</small>`).join("")}
      </div>
    `;

    wrap.appendChild(div);
  });

  document.getElementById("totalTasks").textContent = tasks.length;
  document.getElementById("completedToday").textContent = done;
  document.getElementById("longestStreak").textContent = longest;

  emptyState.style.display = filtered.length === 0 ? "block" : "none";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    try {
      const parsed = JSON.parse(r.result);
      if (!Array.isArray(parsed)) throw new Error("Invalid backup format: expected an array of goals");
      // Normalize imported tasks so old backups receive safe defaults
      tasks = parsed.map(normalizeTask);
      save();
      alert("✅ Backup Imported Successfully (" + tasks.length + " goals restored)");
    } catch (err) {
      alert("❌ Failed to import backup: " + err.message);
    }
  };

  r.readAsText(file);
};

// ================= HEADER BUTTONS =================
notifStatusBtn.onclick = async () => {
  if (Notification.permission === 'denied') {
    showBanner("Notifications are blocked in your browser. Please click the lock/settings icon in the address bar to allow notifications.", "warning", 10000);
    return;
  }
  await requestPushSubscription();
};

testPushBtn.onclick = async () => {
  let sub = currentPushSubscription;
  if (!sub) {
    sub = await requestPushSubscription();
  }

  if (!sub) {
    showBanner("Please enable notifications before testing.", "warning");
    return;
  }

  showBanner("📡 Dispatching test push notification...", "info", 3000);

  try {
    const res = await fetch('/.netlify/functions/send-test-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        title: '🔥 Streak Tracker Pro: Push Test',
        message: 'Awesome! Background push notifications are fully working on your device!'
      })
    });

    if (res.ok) {
      showBanner("✅ Test push dispatched! Watch for your desktop/mobile notification toast.", "success");
    } else {
      // If serverless endpoint returned an error (e.g. running statically without Netlify functions)
      const data = await res.json().catch(() => ({}));
      console.warn("Backend test push error:", data);
      // Local fallback test via ServiceWorker
      if (swRegistration) {
        swRegistration.showNotification('🔥 Streak Tracker Pro: Local Push Test', {
          body: 'Local notification test passed! (Backend function status: ' + (res.status || 'offline') + ')',
          icon: '/assets/icons/icon-192.png',
          badge: '/assets/icons/badge-72.png'
        });
        showBanner("🔔 Local notification delivered via Service Worker!", "success");
      } else {
        showBanner("Backend test failed: " + (data.details || res.statusText), "warning");
      }
    }
  } catch (err) {
    // Local fallback test if offline / static
    if (swRegistration) {
      swRegistration.showNotification('🔥 Streak Tracker Pro: Service Worker Test', {
        body: 'Service worker notification active! Note: Deploy with Netlify to connect backend scheduler.',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/badge-72.png'
      });
      showBanner("🔔 Local Service Worker notification triggered!", "info");
    } else {
      showBanner("Push test failed: " + err.message, "warning");
    }
  }
};

// ================= INITIALIZE =================
registerServiceWorker();
render();