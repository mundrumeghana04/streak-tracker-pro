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
  const webpush = initWebPush();
  const supabase = getSupabaseClient();

  // 1. Fetch all active reminders
  const { data: reminders, error } = await supabase
    .from('streak_reminders')
    .select('*')
    .eq('reminder_enabled', true);

  if (error) {
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
    const tz = reminder.timezone || 'Asia/Kolkata';
    const todayLocal = getLocalDateString(tz, now);
    const timeLocal = getLocalTimeString(tz, now);

    // Condition 1: Check if already completed today
    if (reminder.last_completed === todayLocal) {
      results.skippedCompleted++;
      continue;
    }

    // Condition 2: For target goals, check if goal is already completed
    if (
      reminder.goal_type === 'target' &&
      reminder.target_days > 0 &&
      reminder.current_streak >= reminder.target_days
    ) {
      results.skippedTargetCompleted++;
      continue;
    }

    // Condition 3: Check if already sent today (at most once per day)
    if (reminder.last_reminder_sent === todayLocal) {
      results.skippedAlreadySent++;
      continue;
    }

    // Condition 4: Check if scheduled time has arrived
    const [remHour, remMin] = (reminder.reminder_time || '19:00').split(':').map(Number);
    const [curHour, curMin] = timeLocal.split(':').map(Number);

    const reminderMinutes = remHour * 60 + remMin;
    const currentMinutes = curHour * 60 + curMin;

    // Trigger if current time has reached reminder time, within a 120-minute window
    // (allows hourly cron or slight network/server execution jitter)
    const minutesDiff = currentMinutes - reminderMinutes;
    const isTimeToRemind = minutesDiff >= 0 && minutesDiff <= 120;

    if (!isTimeToRemind) {
      results.skippedNotTimeYet++;
      continue;
    }

    // Format personalized dynamic push payload
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
      await webpush.sendNotification(reminder.subscription, pushPayload);

      // Record that reminder was successfully sent today
      await supabase
        .from('streak_reminders')
        .update({
          last_reminder_sent: todayLocal,
          updated_at: new Date().toISOString()
        })
        .eq('id', reminder.id);

      results.sent++;
      console.log(`[check-reminders] Successfully sent reminder to task ${reminder.task_id} ("${reminder.title}")`);

    } catch (pushErr) {
      console.error(`[check-reminders] Push failed for task ${reminder.task_id}:`, pushErr.message);

      // HTTP 404 or 410 means subscription expired or user uninstalled / revoked permission
      if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
        console.log(`[check-reminders] Removing expired subscription for task ${reminder.task_id}`);
        await supabase
          .from('streak_reminders')
          .delete()
          .eq('id', reminder.id);
        results.expiredSubscriptionsRemoved++;
      } else {
        results.errors.push({
          taskId: reminder.task_id,
          error: pushErr.message,
          statusCode: pushErr.statusCode
        });
      }
    }
  }

  return results;
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return getCorsResponse(204, {});
  }

  // Security check: If CRON_SECRET is configured, check Authorization header
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const authHeader = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    const querySecret = (event.queryStringParameters && event.queryStringParameters.secret) || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '');

    if (bearerToken !== expectedSecret && querySecret !== expectedSecret) {
      return getCorsResponse(401, { error: 'Unauthorized: Invalid or missing cron secret' });
    }
  }

  try {
    const results = await runCheckReminders();
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
