// netlify/functions/send-test-push.js
const { getCorsResponse, initWebPush } = require('./utils');

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return getCorsResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return getCorsResponse(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { subscription, title, message } = body;

    if (!subscription || !subscription.endpoint) {
      return getCorsResponse(400, { error: 'Missing push subscription object' });
    }

    const webpush = initWebPush();

    const payload = JSON.stringify({
      title: title || '🔥 Streak Tracker Pro: Test Alert!',
      body: message || 'Web Push notifications are working perfectly on this device!',
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/badge-72.png',
      tag: 'streak-test-push',
      data: {
        url: '/',
        timestamp: Date.now()
      }
    });

    await webpush.sendNotification(subscription, payload);

    return getCorsResponse(200, {
      success: true,
      message: 'Test notification sent successfully'
    });

  } catch (err) {
    console.error('[send-test-push] Error:', err);
    return getCorsResponse(500, {
      error: 'Failed to send test push notification',
      details: err.message,
      statusCode: err.statusCode
    });
  }
};
