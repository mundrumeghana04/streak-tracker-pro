// netlify/functions/delete-subscription.js
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
    const { taskId, endpoint } = body;

    if (!taskId) {
      return getCorsResponse(400, { error: 'Missing required field: taskId' });
    }

    const supabase = getSupabaseClient();

    let query = supabase.from('streak_reminders').delete();

    if (endpoint) {
      const endpointHash = generateEndpointHash(endpoint);
      query = query.eq('id', `${endpointHash}_${taskId}`);
    } else {
      query = query.eq('task_id', Number(taskId));
    }

    const { error } = await query;

    if (error) {
      console.error('[delete-subscription] Supabase error:', error);
      return getCorsResponse(500, { error: error.message });
    }

    return getCorsResponse(200, {
      success: true,
      message: 'Reminder successfully removed'
    });

  } catch (err) {
    console.error('[delete-subscription] Error:', err);
    return getCorsResponse(500, { error: err.message || 'Internal Server Error' });
  }
};
