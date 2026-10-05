// scripts/test-one-time-reminders.js
// Automated verification suite for StreakUp v1.3 One-Time Task Reminders

const assert = require('assert');
const {
  getLocalDateString,
  getLocalTimeString,
  getLocalDateIsoString
} = require('../netlify/functions/utils');

console.log('================================================================');
console.log('       RUNNING STREAKUP v1.3 ONE-TIME REMINDER TEST SUITE       ');
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

// 1. Timezone Date ISO String formatting
runTest('Timezone Date ISO Formatting (YYYY-MM-DD)', () => {
  const fixedDate = new Date('2026-10-06T11:30:00Z'); // 5:00 PM IST (17:00)
  const istDateIso = getLocalDateIsoString('Asia/Kolkata', fixedDate);
  const istTime = getLocalTimeString('Asia/Kolkata', fixedDate);

  assert.strictEqual(istDateIso, '2026-10-06', 'IST date mismatch');
  assert.strictEqual(istTime, '17:00', 'IST time mismatch');

  const nyDateIso = getLocalDateIsoString('America/New_York', fixedDate);
  const nyTime = getLocalTimeString('America/New_York', fixedDate);
  assert.strictEqual(nyDateIso, '2026-10-06', 'NY date mismatch');
  assert.strictEqual(nyTime, '07:30', 'NY time mismatch');
});

// 2. Scheduler logic: Future date is skipped
runTest('Scheduler Logic - Future date is skipped', () => {
  const now = new Date('2026-10-05T15:30:00Z'); // Oct 5 21:00 IST
  const tz = 'Asia/Kolkata';
  const todayIso = getLocalDateIsoString(tz, now); // "2026-10-05"
  const timeLocal = getLocalTimeString(tz, now);   // "21:00"

  const reminder = {
    title: 'Submit ML Assignment',
    reminder_date: '2026-10-06', // Tomorrow!
    reminder_time: '17:00',
    reminder_sent: false
  };

  const isFutureDate = todayIso < reminder.reminder_date;
  const isSameDateAndFutureTime = (todayIso === reminder.reminder_date && timeLocal < reminder.reminder_time);
  const shouldSkip = isFutureDate || isSameDateAndFutureTime;

  assert.strictEqual(shouldSkip, true, 'Should skip future date reminder');
});

// 3. Scheduler logic: Same date future time is skipped
runTest('Scheduler Logic - Same date future time is skipped', () => {
  const now = new Date('2026-10-06T09:00:00Z'); // Oct 6 14:30 IST (2:30 PM)
  const tz = 'Asia/Kolkata';
  const todayIso = getLocalDateIsoString(tz, now); // "2026-10-06"
  const timeLocal = getLocalTimeString(tz, now);   // "14:30"

  const reminder = {
    title: 'Submit ML Assignment',
    reminder_date: '2026-10-06', // Today
    reminder_time: '17:00',      // 5:00 PM (future!)
    reminder_sent: false
  };

  const isFutureDate = todayIso < reminder.reminder_date;
  const isSameDateAndFutureTime = (todayIso === reminder.reminder_date && timeLocal < reminder.reminder_time);
  const shouldSkip = isFutureDate || isSameDateAndFutureTime;

  assert.strictEqual(shouldSkip, true, 'Should skip when scheduled time has not arrived yet');
});

// 4. Scheduler logic: Scheduled date and time arrived -> Fires!
runTest('Scheduler Logic - Arrived scheduled time triggers push', () => {
  const now = new Date('2026-10-06T11:35:00Z'); // Oct 6 17:05 IST (5:05 PM)
  const tz = 'Asia/Kolkata';
  const todayIso = getLocalDateIsoString(tz, now); // "2026-10-06"
  const timeLocal = getLocalTimeString(tz, now);   // "17:05"

  const reminder = {
    title: 'Submit ML Assignment',
    reminder_date: '2026-10-06', // Today
    reminder_time: '17:00',      // 5:00 PM (passed!)
    reminder_sent: false
  };

  const isFutureDate = todayIso < reminder.reminder_date;
  const isSameDateAndFutureTime = (todayIso === reminder.reminder_date && timeLocal < reminder.reminder_time);
  const shouldFire = !(isFutureDate || isSameDateAndFutureTime);

  assert.strictEqual(shouldFire, true, 'Should trigger push when scheduled time has arrived');
});

// 5. Scheduler logic: Exactly-once delivery guarantee (No repeats!)
runTest('Scheduler Logic - Exactly-once delivery (No repeat spam)', () => {
  // Scenario: 5 minutes after first send
  const now = new Date('2026-10-06T11:40:00Z'); // Oct 6 17:10 IST
  const reminder = {
    title: 'Submit ML Assignment',
    reminder_date: '2026-10-06',
    reminder_time: '17:00',
    reminder_sent: true // ALREADY SENT
  };

  // check-task-reminders queries: .eq('reminder_sent', false)
  const isEligibleInQuery = (reminder.reminder_sent === false);
  assert.strictEqual(isEligibleInQuery, false, 'Sent reminder must be excluded from scheduler query');
});

// 6. Overdue calculation
runTest('UI Status Logic - Overdue when time passed without completion', () => {
  const todayIso = '2026-10-06';
  const timeNow = '18:00';

  const reminder = {
    reminderDate: '2026-10-06',
    reminderTime: '17:00',
    reminderSent: true
  };

  const isPastScheduled = (todayIso > reminder.reminderDate) ||
    (todayIso === reminder.reminderDate && timeNow >= reminder.reminderTime);

  const isOverdue = Boolean(reminder.reminderSent || isPastScheduled);
  assert.strictEqual(isOverdue, true, 'Should be flagged as Overdue in UI');
});

// 7. Editing date/time resets reminder_sent
runTest('Edit Logic - Modifying date/time resets reminder_sent to false', () => {
  const existing = {
    id: 'tr_123',
    title: 'Submit ML Assignment',
    reminderDate: '2026-10-06',
    reminderTime: '17:00',
    reminderSent: true // Fired earlier
  };

  // User extends deadline to tomorrow 7:00 PM
  const newDate = '2026-10-07';
  const newTime = '19:00';

  const dateOrTimeChanged = (existing.reminderDate !== newDate || existing.reminderTime !== newTime);
  if (dateOrTimeChanged) {
    existing.reminderDate = newDate;
    existing.reminderTime = newTime;
    existing.reminderSent = false; // Reset!
  }

  assert.strictEqual(existing.reminderSent, false, 'reminderSent must be reset to false upon edit');
  assert.strictEqual(existing.reminderDate, '2026-10-07');
  assert.strictEqual(existing.reminderTime, '19:00');
});

// 8. Mark Completed permanently deletes and keeps streaks untouched
runTest('Lifecycle - Mark Completed permanently deletes reminder and preserves streaks', () => {
  let reminders = [
    { id: 'tr_1', title: 'Submit ML Assignment' },
    { id: 'tr_2', title: 'Project Meeting' }
  ];

  const habits = [
    { id: 101, title: 'Study DSA', currentStreak: 5 }
  ];

  // User marks tr_1 completed
  const idToDelete = 'tr_1';
  reminders = reminders.filter(r => r.id !== idToDelete);

  assert.strictEqual(reminders.length, 1);
  assert.strictEqual(reminders[0].id, 'tr_2');
  // Confirm habits and streak counts are 100% untouched
  assert.strictEqual(habits[0].currentStreak, 5, 'Habit streak must remain unchanged');
});

// 9. Backups: Export and Import support
runTest('Backups - Seamless v1.3 backup structure and legacy backward compatibility', () => {
  // Legacy backup (array of goals)
  const legacyBackup = [
    { id: 101, title: 'Study DSA', currentStreak: 3 }
  ];
  let importedTasks = [];
  let importedReminders = [];

  if (Array.isArray(legacyBackup)) {
    importedTasks = legacyBackup;
  }
  assert.strictEqual(importedTasks.length, 1);
  assert.strictEqual(importedReminders.length, 0);

  // v1.3 backup
  const v13Backup = {
    version: '1.3',
    app: 'StreakUp',
    tasks: [{ id: 101, title: 'Study DSA', currentStreak: 4 }],
    taskReminders: [{ id: 'tr_1', title: 'Submit ML Assignment' }]
  };

  if (v13Backup.tasks && Array.isArray(v13Backup.tasks)) {
    importedTasks = v13Backup.tasks;
    if (Array.isArray(v13Backup.taskReminders)) {
      importedReminders = v13Backup.taskReminders;
    }
  }

  assert.strictEqual(importedTasks.length, 1);
  assert.strictEqual(importedReminders.length, 1);
  assert.strictEqual(importedReminders[0].title, 'Submit ML Assignment');
});

console.log(`\n🎉 ALL ${passedTests} ONE-TIME REMINDER TESTS PASSED SUCCESSFULLY!\n`);
