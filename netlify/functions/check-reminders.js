// netlify/functions/check-reminders.js
// Evaluates active reminders and dispatches background Web Push notifications

const {
  getCorsResponse,
  initWebPush,
  getSupabaseClient,
  getLocalDateString,
  getLocalTimeString
} = require('./utils');

require('dotenv').config();

function getDynamicNotificationContent(title, category, streak) {
  const cat = (category || '').toLowerCase();
  const cleanTitle = (title || 'goal').trim();
  // Strip redundant leading action words if category matches (e.g. "Study DSA" -> "DSA")
  const subjectName = cleanTitle.replace(/^(study|read|practice|workout|exercise|code)\s+/i, '');

  let heading = `🔥 Don't break your ${cleanTitle} streak!`;
  let body = streak > 0
    ? `You're on a ${streak}-day streak! Complete today's goal to keep it alive.`
    : `💪 One small step today keeps your streak alive! Complete today's goal.`;

  if (cat.includes('study')) {
    heading = `📚 Time to study ${subjectName}!`;
    body = `🔥 Don't break your ${subjectName} streak! Complete today's goal.`;
  } else if (cat.includes('fitness')) {
    heading = `🏃 Keep your Fitness streak alive!`;
    body = `💪 One small workout for "${cleanTitle}" keeps your streak alive!`;
  } else if (cat.includes('coding')) {
    heading = `🔥 Don't break your ${cleanTitle} streak!`;
    body = `💻 Keep your Coding streak alive! Complete today's goal.`;
  } else if (cat.includes('reading')) {
    heading = `📖 Your Reading goal is waiting for you!`;
    body = `A few pages for "${cleanTitle}" keeps your streak going strong!`;
  } else if (cat.includes('meditation') || cat.includes('health')) {
    heading = `🧘 Take a moment for ${cleanTitle}!`;
    body = `Prioritize your well-being today and log your progress.`;
  }

  return { heading, body };
}
async function runCheckReminders() {
  console.log('[DEBUG] check-reminders started');

  const webpush = initWebPush();
  console.log('[DEBUG] VAPID initialized');

  const supabase = getSupabaseClient();
  console.log('[DEBUG] Supabase initialized');

  const { data: reminders, error } = await supabase
    .from('streak_reminders')
    .select('*')
    .eq('reminder_enabled', true);

  console.log('[DEBUG] Supabase query completed');
  console.log('[DEBUG] Reminder count:', reminders?.length || 0);

  if (error) {
    console.error('[DEBUG] Supabase query error:', error);
    throw new Error(`Failed to query reminders: ${error.message}`);
  }

  const results = {
    totalChecked: (reminders || []).length,
    sent: 0,
    skippedCompleted: 0,
    skippedTargetCompleted: 0,
    skippedAlreadySent: 0,
    skippedNotTimeYet: 0,
    errors: [],
    expiredSubscriptionsRemoved: 0
  };

  const now = new Date();

  for (const reminder of (reminders || [])) {
    console.log('[DEBUG] Checking reminder:', {
      id: reminder.id,
      title: reminder.title,
      reminder_time: reminder.reminder_time,
      timezone: reminder.timezone,
      last_completed: reminder.last_completed,
      last_reminder_sent: reminder.last_reminder_sent
    });

    const tz = reminder.timezone || 'Asia/Kolkata';
    const todayLocal = getLocalDateString(tz, now);
    const timeLocal = getLocalTimeString(tz, now);

    console.log('[DEBUG] Current local time:', {
      timezone: tz,
      today: todayLocal,
      currentTime: timeLocal,
      scheduledTime: reminder.reminder_time
    });

    // 1. Skip if the task was already completed today
    if (reminder.last_completed === todayLocal) {
      console.log(
        `[DEBUG] SKIP - "${reminder.title}" already completed today`
      );
      results.skippedCompleted++;
      continue;
    }

    // 2. Skip if target goal has already been completed
    if (
      reminder.goal_type === 'target' &&
      reminder.target_days > 0 &&
      reminder.current_streak >= reminder.target_days
    ) {
      console.log(
        `[DEBUG] SKIP - "${reminder.title}" target already completed`
      );
      results.skippedTargetCompleted++;
      continue;
    }

    // 3. Skip if reminder was already sent today
    if (reminder.last_reminder_sent === todayLocal) {
      console.log(
        `[DEBUG] SKIP - "${reminder.title}" reminder already sent today`
      );
      results.skippedAlreadySent++;
      continue;
    }

    // 4. Check scheduled time
    const [remHour, remMin] = (reminder.reminder_time || '19:00')
      .split(':')
      .map(Number);

    const [curHour, curMin] = timeLocal
      .split(':')
      .map(Number);

    const reminderMinutes = remHour * 60 + remMin;
    const currentMinutes = curHour * 60 + curMin;

    const minutesDiff = currentMinutes - reminderMinutes;

    console.log('[DEBUG] Time calculation:', {
      scheduledMinutes: reminderMinutes,
      currentMinutes,
      minutesDiff
    });

    // Allow a 180-minute window after scheduled time
    const isTimeToRemind =
  minutesDiff >= 0 && minutesDiff <= 180;

    if (!isTimeToRemind) {
      console.log(
        `[DEBUG] SKIP - "${reminder.title}" reminder time has not arrived`
      );
      results.skippedNotTimeYet++;
      continue;
    }

    // 5. Create personalized notification
    const { heading, body } = getDynamicNotificationContent(
      reminder.title,
      reminder.category,
      reminder.current_streak
    );

    const pushPayload = JSON.stringify({
      title: heading,
      body,
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/badge-72.png',
      tag: `streak-${reminder.task_id}-${todayLocal.replace(/\s+/g, '-')}`,
      data: {
        taskId: reminder.task_id,
        url: '/',
        today: todayLocal
      }
    });

    try {
      console.log(
        `[DEBUG] ATTEMPTING PUSH for "${reminder.title}"`
      );

      await webpush.sendNotification(
        reminder.subscription,
        pushPayload
      );

      console.log(
        `[DEBUG] PUSH SENT SUCCESSFULLY for "${reminder.title}"`
      );

      // Record successful send
      const { error: updateError } = await supabase
        .from('streak_reminders')
        .update({
          last_reminder_sent: todayLocal,
          updated_at: new Date().toISOString()
        })
        .eq('id', reminder.id);

      if (updateError) {
        console.error(
          '[DEBUG] Failed to update last_reminder_sent:',
          updateError
        );
      } else {
        console.log(
          `[DEBUG] last_reminder_sent updated for "${reminder.title}"`
        );
      }

      results.sent++;

    } catch (pushErr) {
      console.error(
        `[DEBUG] PUSH FAILED for "${reminder.title}":`,
        pushErr
      );

      // Expired subscription
      if (
        pushErr.statusCode === 404 ||
        pushErr.statusCode === 410
      ) {
        console.log(
          `[DEBUG] Removing expired subscription for "${reminder.title}"`
        );

        await supabase
          .from('streak_reminders')
          .delete()
          .eq('id', reminder.id);

        results.expiredSubscriptionsRemoved++;
      } else {
        results.errors.push({
          taskId: reminder.task_id,
          title: reminder.title,
          error: pushErr.message,
          statusCode: pushErr.statusCode
        });
      }
    }
  }

console.error('[DEBUG] FINAL RESULTS:', JSON.stringify(results, null, 2));
  return results;
}

exports.handler = async (event, context) => {
  try {
    console.log('[DEBUG] check-reminders handler started');

    const results = await runCheckReminders();

    console.log('[DEBUG] check-reminders completed:', results);

    return getCorsResponse(200, {
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (err) {
    console.error('[check-reminders] Scheduler error:', err);

    return getCorsResponse(500, {
      error: 'Failed to execute reminder check',
      details: err.message
    });
  }
};