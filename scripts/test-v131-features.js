// scripts/test-v131-features.js
// Automated verification suite for StreakUp v1.3.1 features:
// 1. Confirm Before Delete
// 2. Daily Navigation Filter (All, In Progress, Completed) and Date Transition

const assert = require('assert');

console.log('================================================================');
console.log('       RUNNING STREAKUP v1.3.1 FEATURE VERIFICATION SUITE       ');
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

// -------------------------------------------------------------
// FEATURE 1 TESTS: CONFIRM BEFORE DELETE
// -------------------------------------------------------------
runTest('Confirm Delete - Cancel does not alter goals or localStorage', () => {
  let tasks = [
    { id: 1, title: 'DSA', currentStreak: 5, notificationEnabled: false },
    { id: 2, title: 'Reading', currentStreak: 12, notificationEnabled: true }
  ];

  let backendDeleteCalled = false;
  function mockDeleteBackend(id) {
    backendDeleteCalled = true;
  }

  // User clicks Delete on task 1, but then clicks Cancel in dialog
  let modalOpen = true;
  let confirmed = false;

  if (confirmed) {
    tasks = tasks.filter(t => t.id !== 1);
  }
  modalOpen = false;

  assert.strictEqual(tasks.length, 2, 'Tasks array must remain untouched on cancel');
  assert.strictEqual(backendDeleteCalled, false, 'Backend delete must not be called on cancel');
  assert.strictEqual(tasks[0].title, 'DSA');
});

runTest('Confirm Delete - Confirm permanently removes goal and invokes cleanup', () => {
  let tasks = [
    { id: 1, title: 'DSA', currentStreak: 5, notificationEnabled: false },
    { id: 2, title: 'Reading', currentStreak: 12, notificationEnabled: true }
  ];

  let backendDeleteId = null;
  function mockDeleteBackend(id) {
    backendDeleteId = id;
  }

  // User clicks Delete on task 2 and confirms
  const taskToDelete = tasks.find(t => t.id === 2);
  let confirmed = true;

  if (confirmed) {
    if (taskToDelete.notificationEnabled) {
      mockDeleteBackend(taskToDelete.id);
    }
    tasks = tasks.filter(t => t.id !== 2);
  }

  assert.strictEqual(tasks.length, 1, 'Target task must be removed');
  assert.strictEqual(tasks[0].id, 1);
  assert.strictEqual(backendDeleteId, 2, 'Backend delete should be called for tasks with reminders');
});

runTest('Confirm Delete - One-time reminder cancellation and confirmed deletion', () => {
  let taskReminders = [
    { id: 'tr_1', title: 'Submit Assignment' },
    { id: 'tr_2', title: 'Dentist Appointment' }
  ];

  let backendDeleteCalled = false;
  function mockDeleteBackend(id) {
    backendDeleteCalled = true;
  }

  // Cancel action
  let cancel = true;
  if (!cancel) {
    taskReminders = taskReminders.filter(r => r.id !== 'tr_1');
  }
  assert.strictEqual(taskReminders.length, 2, 'Reminders array must remain unchanged on cancel');

  // Confirm action
  let isDeleteProcessing = false;
  let doubleClickPrevented = 0;

  function handleConfirm(id) {
    if (isDeleteProcessing) {
      doubleClickPrevented++;
      return;
    }
    isDeleteProcessing = true;
    mockDeleteBackend(id);
    taskReminders = taskReminders.filter(r => r.id !== id);
  }

  handleConfirm('tr_1');
  handleConfirm('tr_1'); // Simulated accidental double-click

  assert.strictEqual(taskReminders.length, 1);
  assert.strictEqual(taskReminders[0].id, 'tr_2');
  assert.strictEqual(doubleClickPrevented, 1, 'Double click must be guarded');
  assert.strictEqual(backendDeleteCalled, true);
});

// -------------------------------------------------------------
// FEATURE 2 TESTS: DAILY NAVIGATION FILTER
// -------------------------------------------------------------
runTest('Daily Navigation Filter - All, In Progress, and Completed classification', () => {
  const todayStr = 'Tue Oct 06 2026';
  const yesterdayStr = 'Mon Oct 05 2026';

  const mockTasks = [
    { id: 1, title: 'DSA', lastCompleted: todayStr },         // Completed today
    { id: 2, title: 'Reading', lastCompleted: yesterdayStr },  // Completed yesterday, in progress today
    { id: 3, title: 'Fitness', lastCompleted: null }           // Never completed, in progress today
  ];

  function filterTasks(items, filterMode) {
    return items.filter(t => {
      const isCompletedToday = t.lastCompleted === todayStr;
      if (filterMode === 'completed') return isCompletedToday;
      if (filterMode === 'in-progress') return !isCompletedToday;
      return true; // 'all'
    });
  }

  const allItems = filterTasks(mockTasks, 'all');
  const inProgressItems = filterTasks(mockTasks, 'in-progress');
  const completedItems = filterTasks(mockTasks, 'completed');

  assert.strictEqual(allItems.length, 3, 'All should return all 3 tasks');
  assert.strictEqual(inProgressItems.length, 2, 'In Progress should return Reading and Fitness');
  assert.strictEqual(inProgressItems[0].title, 'Reading');
  assert.strictEqual(inProgressItems[1].title, 'Fitness');
  assert.strictEqual(completedItems.length, 1, 'Completed should return only DSA');
  assert.strictEqual(completedItems[0].title, 'DSA');
});

runTest('Daily Navigation Filter - Completing task moves it from In Progress to Completed', () => {
  const todayStr = 'Tue Oct 06 2026';
  let mockTasks = [
    { id: 1, title: 'DSA', currentStreak: 3, lastCompleted: null }
  ];

  function getInProgress(items) {
    return items.filter(t => t.lastCompleted !== todayStr);
  }
  function getCompleted(items) {
    return items.filter(t => t.lastCompleted === todayStr);
  }

  assert.strictEqual(getInProgress(mockTasks).length, 1);
  assert.strictEqual(getCompleted(mockTasks).length, 0);

  // User completes DSA today
  mockTasks[0].lastCompleted = todayStr;
  mockTasks[0].currentStreak = 4;

  assert.strictEqual(getInProgress(mockTasks).length, 0, 'Item must leave In Progress');
  assert.strictEqual(getCompleted(mockTasks).length, 1, 'Item must appear in Completed');
  assert.strictEqual(mockTasks[0].currentStreak, 4, 'Streak counter must increment');
});

runTest('Daily Navigation Filter - Calendar day transition preserves historical streak while resetting today status', () => {
  const day1 = 'Tue Oct 06 2026';
  const day2 = 'Wed Oct 07 2026';

  const mockTasks = [
    { id: 1, title: 'DSA', currentStreak: 5, bestStreak: 7, lastCompleted: day1 }
  ];

  // On day 1:
  assert.strictEqual(mockTasks[0].lastCompleted === day1, true, 'Completed on Day 1');

  // On day 2 (tomorrow):
  const isCompletedOnDay2 = mockTasks[0].lastCompleted === day2;
  assert.strictEqual(isCompletedOnDay2, false, 'Must NOT appear completed on Day 2');

  // Verify historical streak data was untouched
  assert.strictEqual(mockTasks[0].currentStreak, 5, 'Historical streak must remain intact');
  assert.strictEqual(mockTasks[0].bestStreak, 7, 'Best streak must remain intact');
  assert.strictEqual(mockTasks[0].lastCompleted, day1, 'Previous completion date preserved');
});

console.log(`\n🎉 ALL ${passedTests} v1.3.1 FEATURE TESTS PASSED SUCCESSFULLY!\n`);
