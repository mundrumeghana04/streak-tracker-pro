// netlify/functions/utils.js
// Shared helpers for Web Push, Supabase, and CORS handling

const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Load environment variables if running locally
require('dotenv').config();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

function getCorsResponse(statusCode = 200, body = {}) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body)
  };
}

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@streaktracker.pro';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured in environment variables');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) not configured');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function generateEndpointHash(endpoint) {
  return crypto.createHash('sha256').update(endpoint || '').digest('hex').substring(0, 16);
}

// Format date string consistently matching client new Date().toDateString()
// in a specific timezone
function getLocalDateString(timezone = 'Asia/Kolkata', dateObj = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
    // Formatter outputs e.g. "Sat, Oct 03, 2026"
    // Normalize to match JavaScript Date.toDateString(): "Sat Oct 03 2026"
    const parts = formatter.formatToParts(dateObj);
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value || '';
    return `${weekday} ${month} ${day} ${year}`.trim();
  } catch (e) {
    return dateObj.toDateString();
  }
}

// Get HH:MM (24-hour) in a specific timezone
function getLocalTimeString(timezone = 'Asia/Kolkata', dateObj = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(dateObj); // "19:00"
  } catch (e) {
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = String(dateObj.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

module.exports = {
  CORS_HEADERS,
  getCorsResponse,
  initWebPush,
  getSupabaseClient,
  generateEndpointHash,
  getLocalDateString,
  getLocalTimeString
};
