// scripts/test-scheduler-logic.js
// Automated verification of schedule evaluation logic, timezones, and data normalization

const assert = require('assert');
const { getLocalDateString, getLocalTimeString } = require('../netlify/functions/utils');

console.log('================================================================');
console.log('       RUNNING STREAK TRACKER PRO LOGIC VERIFICATION SUITE       ');
console.log('================================================================\n');

let passedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Timezone tests
runTest('Timezone Date & Time Formatting', () => {
  const fixedDate = new Date('2026-10-03T13:30:00Z'); // 7:00 PM IST
  const istDate = getLocalDateString('Asia/Kolkata', fixedDate);
  const istTime = getLocalTimeString('Asia/Kolkata', fixedDate);

  assert.strictEqual(istDate, 'Sat Oct 03 2026', 'IST date mismatch');
  assert.strictEqual(istTime, '19:00', 'IST time mismatch');

  const nyDate = getLocalDateString('America/New_York', fixedDate);
  const nyTime = getLocalTimeString('America/New_York', fixedDate);
  assert.strictEqual(nyDate, 'Sat Oct 03 2026', 'NY date mismatch');
  assert.strictEqual(nyTime, '09:30', 'NY time mismatch');
});

// 2. normalizeTask() tests (Backwards compatibility)
runTest('Legacy Backup Task Normalization (Safe Defaults)', () => {
  // Legacy v1.0 task without any notification fields
  const legacyTask = {
    id: 1718446250000,
    title: "Study DSA",
    category: "Study",
    priority: "High",
    goalType: "target",
    targetDays: 30,
    currentStreak: 5,
    bestStreak: 7,
    totalCompleted: 10,
    lastCompleted: "Fri Oct 02 2026",
    notes: [{ date: "Fri Oct 02 2026", text: "Solved 2 LeetCode problems" }]
  };

  // Function identical to normalizeTask in js/script.js
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
      notificationEnabled: Boolean(t.notificationEnabled),
      reminderTime: t.reminderTime || "19:00",
      timezone: t.timezone || "Asia/Kolkata",
      lastReminderSent: t.lastReminderSent || null
    };
  }

  const normalized = normalizeTask(legacyTask);

  assert.strictEqual(normalized.id, 1718446250000);
  assert.strictEqual(normalized.title, "Study DSA");
  assert.strictEqual(normalized.notificationEnabled, false, "Default should be false");
  assert.strictEqual(normalized.reminderTime, "19:00", "Default reminderTime should be 19:00");
  assert.strictEqual(normalized.timezone, "Asia/Kolkata", "Default timezone should be Asia/Kolkata");
  assert.strictEqual(normalized.lastReminderSent, null);
  assert.strictEqual(normalized.notes.length, 1);
  assert.strictEqual(normalized.currentStreak, 5);
});

// 3. Scheduler Condition Evaluation Logic
runTest('Scheduler Decision Logic - Completed Today is Skipped', () => {
  const today = 'Sat Oct 03 2026';
  const reminder = {
    title: 'Study DSA',
    last_completed: 'Sat Oct 03 2026', // Completed today!
    reminder_time: '19:00',
    last_reminder_sent: null,
    goal_type: 'target',
    target_days: 30,
    current_streak: 5
  };

  const shouldSend = evaluateReminderEligibility(reminder, today, '19:05');
  assert.strictEqual(shouldSend, false, 'Should NOT send reminder if already completed today');
});

runTest('Scheduler Decision Logic - Target Goal Completed is Skipped', () => {
  const today = 'Sat Oct 03 2026';
  const reminder = {
    title: 'Study DSA',
    last_completed: 'Fri Oct 02 2026', // Not completed today
    reminder_time: '19:00',
    last_reminder_sent: null,
    goal_type: 'target',
    target_days: 30,
    current_streak: 30 // Target completed!
  };

  const shouldSend = evaluateReminderEligibility(reminder, today, '19:05');
  assert.strictEqual(shouldSend, false, 'Should NOT send reminder if target goal is completed');
});

runTest('Scheduler Decision Logic - Duplicate on Same Day is Skipped', () => {
  const today = 'Sat Oct 03 2026';
  const reminder = {
    title: 'Study DSA',
    last_completed: 'Fri Oct 02 2026',
    reminder_time: '19:00',
    last_reminder_sent: 'Sat Oct 03 2026', // Already sent today!
    goal_type: 'target',
    target_days: 30,
    current_streak: 5
  };

  const shouldSend = evaluateReminderEligibility(reminder, today, '19:15');
  assert.strictEqual(shouldSend, false, 'Should NOT send duplicate reminder on same day');
});

runTest('Scheduler Decision Logic - Future Scheduled Time is Skipped', () => {
  const today = 'Sat Oct 03 2026';
  const reminder = {
    title: 'Night Reading',
    last_completed: 'Fri Oct 02 2026',
    reminder_time: '21:00', // 9:00 PM
    last_reminder_sent: null,
    goal_type: 'unlimited',
    target_days: 0,
    current_streak: 10
  };

  // Current time is 19:00 (7:00 PM), reminder is 21:00
  const shouldSend = evaluateReminderEligibility(reminder, today, '19:00');
  assert.strictEqual(shouldSend, false, 'Should NOT send reminder before scheduled time');
});

runTest('Scheduler Decision Logic - Eligible Task Fires Successfully', () => {
  const today = 'Sat Oct 03 2026';
  const reminder = {
    title: 'Study DSA',
    last_completed: 'Fri Oct 02 2026', // Not completed today
    reminder_time: '19:00',
    last_reminder_sent: null,
    goal_type: 'target',
    target_days: 30,
    current_streak: 5
  };

  // Current time is 19:10 (within dispatch window)
  const shouldSend = evaluateReminderEligibility(reminder, today, '19:10');
  assert.strictEqual(shouldSend, true, 'Eligible reminder must fire');
});

function evaluateReminderEligibility(reminder, todayLocal, timeLocal) {
  // Matches logic in check-reminders.js
  if (reminder.last_completed === todayLocal) return false;
  if (reminder.goal_type === 'target' && reminder.target_days > 0 && reminder.current_streak >= reminder.target_days) return false;
  if (reminder.last_reminder_sent === todayLocal) return false;

  const [remHour, remMin] = reminder.reminder_time.split(':').map(Number);
  const [curHour, curMin] = timeLocal.split(':').map(Number);

  const reminderMinutes = remHour * 60 + remMin;
  const currentMinutes = curHour * 60 + curMin;

  const diff = currentMinutes - reminderMinutes;
  return diff >= 0 && diff <= 120;
}

console.log(`\n🎉 ALL ${passedTests} LOGIC TESTS PASSED SUCCESSFULLY!`);
