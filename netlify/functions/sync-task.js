// netlify/functions/sync-task.js
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
    const { taskId, lastCompleted, currentStreak, endpoint } = body;

    if (!taskId) {
      return getCorsResponse(400, { error: 'Missing required field: taskId' });
    }

    const supabase = getSupabaseClient();

    let query = supabase.from('streak_reminders').update({
      last_completed: lastCompleted,
      current_streak: Number(currentStreak) || 0,
      updated_at: new Date().toISOString()
    });

    if (endpoint) {
      const endpointHash = generateEndpointHash(endpoint);
      query = query.eq('id', `${endpointHash}_${taskId}`);
    } else {
      query = query.eq('task_id', Number(taskId));
    }

    const { data, error } = await query.select();

    if (error) {
      console.error('[sync-task] Supabase error:', error);
      return getCorsResponse(500, { error: error.message });
    }

    return getCorsResponse(200, {
      success: true,
      message: 'Task synced successfully',
      updatedCount: (data || []).length
    });

  } catch (err) {
    console.error('[sync-task] Error:', err);
    return getCorsResponse(500, { error: err.message || 'Internal Server Error' });
  }
};
