// netlify/functions/save-subscription.js
const { getCorsResponse, getSupabaseClient, generateEndpointHash } = require('./utils');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return getCorsResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return getCorsResponse(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      taskId,
      title,
      category = 'Other',
      priority = 'Medium',
      goalType = 'unlimited',
      targetDays = 0,
      currentStreak = 0,
      lastCompleted = null,
      reminderEnabled = true,
      reminderTime = '19:00',
      timezone = 'Asia/Kolkata',
      subscription
    } = body;

    if (!taskId) {
      return getCorsResponse(400, { error: 'Missing required field: taskId' });
    }

    if (!subscription || !subscription.endpoint) {
      return getCorsResponse(400, { error: 'Missing required field: subscription' });
    }

    const endpointHash = generateEndpointHash(subscription.endpoint);
    const reminderId = `${endpointHash}_${taskId}`;

    const supabase = getSupabaseClient();

    const record = {
      id: reminderId,
      task_id: Number(taskId),
      endpoint: subscription.endpoint,
      title: title || 'Untitled Goal',
      category,
      priority,
      goal_type: goalType,
      target_days: Number(targetDays) || 0,
      current_streak: Number(currentStreak) || 0,
      last_completed: lastCompleted,
      reminder_enabled: Boolean(reminderEnabled),
      reminder_time: reminderTime,
      timezone: timezone || 'Asia/Kolkata',
      subscription,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('streak_reminders')
      .upsert(record, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('[save-subscription] Supabase error:', error);
      return getCorsResponse(500, {
        error: 'Failed to persist reminder to database',
        details: error.message
      });
    }

    return getCorsResponse(200, {
      success: true,
      message: 'Reminder subscription successfully saved',
      recordId: reminderId
    });

  } catch (err) {
    console.error('[save-subscription] Error:', err);
    return getCorsResponse(500, {
      error: err.message || 'Internal Server Error'
    });
  }
};
