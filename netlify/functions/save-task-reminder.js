// netlify/functions/save-task-reminder.js
// Saves or updates a one-time task reminder in the task_reminders Supabase table

const { getCorsResponse, getSupabaseClient } = require('./utils');

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
      id,
      title,
      description = '',
      reminderDate,
      reminderTime,
      timezone = 'Asia/Kolkata',
      subscription,
      notificationSent = false,
      reminderSent = false
    } = body;

    if (!id) {
      return getCorsResponse(400, { error: 'Missing required field: id' });
    }

    if (!title || !title.trim()) {
      return getCorsResponse(400, { error: 'Missing required field: title' });
    }

    if (!reminderDate || !reminderTime) {
      return getCorsResponse(400, { error: 'Missing required fields: reminderDate, reminderTime' });
    }

    if (!subscription || !subscription.endpoint) {
      return getCorsResponse(400, { error: 'Missing required field: subscription' });
    }

    const supabase = getSupabaseClient();
    const isSent = Boolean(notificationSent || reminderSent);

    const record = {
      id: String(id),
      endpoint: subscription.endpoint,
      title: title.trim(),
      description: (description || '').trim(),
      reminder_date: reminderDate,
      reminder_time: reminderTime,
      timezone: timezone || 'Asia/Kolkata',
      subscription,
      notification_sent: isSent,
      reminder_sent: isSent,
      updated_at: new Date().toISOString()
    };


    const { data, error } = await supabase
      .from('task_reminders')
      .upsert(record, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('[save-task-reminder] Supabase error:', error);
      return getCorsResponse(500, {
        error: 'Failed to persist task reminder',
        details: error.message
      });
    }

    return getCorsResponse(200, {
      success: true,
      message: 'Task reminder saved successfully',
      reminder: data && data[0] ? data[0] : record
    });
  } catch (err) {
    console.error('[save-task-reminder] Error:', err);
    return getCorsResponse(500, {
      error: err.message || 'Internal Server Error'
    });
  }
};
