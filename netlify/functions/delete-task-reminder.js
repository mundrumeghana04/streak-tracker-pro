// netlify/functions/delete-task-reminder.js
// Permanently deletes a one-time task reminder from the task_reminders Supabase table

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
    const { id, endpoint } = body;

    if (!id) {
      return getCorsResponse(400, { error: 'Missing required field: id' });
    }

    const supabase = getSupabaseClient();

    let query = supabase.from('task_reminders').delete().eq('id', String(id));

    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    }

    const { error } = await query;

    if (error) {
      console.error('[delete-task-reminder] Supabase error:', error);
      return getCorsResponse(500, { error: error.message });
    }

    return getCorsResponse(200, {
      success: true,
      message: 'Task reminder permanently deleted from database'
    });
  } catch (err) {
    console.error('[delete-task-reminder] Error:', err);
    return getCorsResponse(500, { error: err.message || 'Internal Server Error' });
  }
};
