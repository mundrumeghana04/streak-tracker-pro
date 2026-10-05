// netlify/functions/check-task-reminders.js
// Evaluates active one-time task reminders and dispatches background Web Push notifications

const {
  getCorsResponse,
  initWebPush,
  getSupabaseClient,
  getLocalDateIsoString,
  getLocalTimeString
} = require('./utils');

require('dotenv').config();

async function runCheckTaskReminders() {
  console.log('[DEBUG] check-task-reminders started');

  const webpush = initWebPush();
  console.log('[DEBUG] VAPID initialized for task reminders');

  const supabase = getSupabaseClient();
  console.log('[DEBUG] Supabase initialized for task reminders');

  // Query one-time reminders that haven't been notified yet
  const { data: reminders, error } = await supabase
    .from('task_reminders')
    .select('*')
    .or('notification_sent.eq.false,reminder_sent.eq.false');

  if (error) {
    console.error('[DEBUG] Supabase query error in check-task-reminders:', error);
    throw new Error(`Failed to query task reminders: ${error.message}`);
  }

  const results = {
    totalPendingChecked: (reminders || []).length,
    sent: 0,
    skippedNotTimeYet: 0,
    errors: [],
    expiredSubscriptionsRemoved: 0
  };

  const now = new Date();

  for (const reminder of (reminders || [])) {
    const tz = reminder.timezone || 'Asia/Kolkata';
    const todayIso = getLocalDateIsoString(tz, now); // e.g. "2026-10-08"
    const timeLocal = getLocalTimeString(tz, now);   // e.g. "11:00"

    const remDate = reminder.reminder_date; // e.g. "2026-10-08"
    const remTime = reminder.reminder_time; // e.g. "11:00"

    console.log('[DEBUG] Checking task reminder:', {
      id: reminder.id,
      title: reminder.title,
      scheduledDate: remDate,
      scheduledTime: remTime,
      todayLocal: todayIso,
      currentTime: timeLocal,
      timezone: tz
    });

    // Check if scheduled date/time has arrived
    const isFutureDate = todayIso < remDate;
    const isSameDateAndFutureTime = (todayIso === remDate && timeLocal < remTime);

    if (isFutureDate || isSameDateAndFutureTime) {
      console.log(`[DEBUG] SKIP - "${reminder.title}" scheduled time (${remDate} ${remTime}) has not arrived`);
      results.skippedNotTimeYet++;
      continue;
    }

    // Scheduled date and time has arrived!
    const heading = '🔔 StreakUp Reminder';
    const body = reminder.description && reminder.description.trim()
      ? `${reminder.title} — ${reminder.description.trim()}`
      : `${reminder.title} is due now.`;

    const pushPayload = JSON.stringify({
      title: heading,
      body,
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/badge-72.png',
      tag: `task-reminder-${reminder.id}`,
      data: {
        reminderId: reminder.id,
        type: 'task-reminder',
        url: '/'
      }
    });

    try {
      console.log(`[DEBUG] SENDING PUSH for task reminder "${reminder.title}"`);
      await webpush.sendNotification(reminder.subscription, pushPayload);
      console.log(`[DEBUG] PUSH SENT SUCCESSFULLY for "${reminder.title}"`);

      // Mark as sent immediately to guarantee no repeated notifications
      const { error: updateError } = await supabase
        .from('task_reminders')
        .update({
          notification_sent: true,
          reminder_sent: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', reminder.id);

      if (updateError) {
        console.error(`[DEBUG] Failed to update notification_sent for ${reminder.id}:`, updateError);
      }

      results.sent++;
    } catch (pushErr) {
      console.error(`[DEBUG] PUSH FAILED for "${reminder.title}":`, pushErr.message);

      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        console.log(`[DEBUG] Subscription expired for task reminder ${reminder.id}. Removing.`);
        await supabase
          .from('task_reminders')
          .delete()
          .eq('id', reminder.id);
        results.expiredSubscriptionsRemoved++;
      } else {
        results.errors.push({
          id: reminder.id,
          title: reminder.title,
          statusCode: pushErr.statusCode,
          message: pushErr.message
        });
      }
    }
  }

  console.log('[DEBUG] check-task-reminders execution finished:', results);
  return results;
}

const handler = async (event, context) => {
  if (event && event.httpMethod === 'OPTIONS') {
    return getCorsResponse(204, {});
  }

  try {
    const results = await runCheckTaskReminders();
    return getCorsResponse(200, {
      success: true,
      timestamp: new Date().toISOString(),
      ...results
    });
  } catch (err) {
    console.error('[check-task-reminders] Fatal Error:', err);
    return getCorsResponse(500, {
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};

exports.handler = handler;
module.exports = {
  handler,
  runCheckTaskReminders
};

