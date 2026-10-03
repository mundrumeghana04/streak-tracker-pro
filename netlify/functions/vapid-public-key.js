// netlify/functions/vapid-public-key.js
const { getCorsResponse } = require('./utils');
require('dotenv').config();

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return getCorsResponse(204, {});
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return getCorsResponse(500, {
      error: 'VAPID_PUBLIC_KEY is not configured on the server.',
      hint: 'Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your Netlify environment variables or .env file.'
    });
  }

  return getCorsResponse(200, { publicKey });
};
