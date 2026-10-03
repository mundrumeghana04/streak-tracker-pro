// scripts/test-push.js
// Sends a manual test push notification using the configuration in .env

require('dotenv').config();
const webpush = require('web-push');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@streaktracker.pro';

if (!publicKey || !privateKey) {
  console.error('Error: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be defined in your .env file.');
  process.exit(1);
}

webpush.setVapidDetails(subject, publicKey, privateKey);

// If passed a subscription JSON file or string argument:
const subArg = process.argv[2];

if (!subArg) {
  console.log('Usage: node scripts/test-push.js \'<subscription_json_or_filepath>\'');
  console.log('Tip: You can get your device subscription JSON from the browser console or test button.');
  process.exit(0);
}

let subscription;
try {
  const fs = require('fs');
  if (fs.existsSync(subArg)) {
    subscription = JSON.parse(fs.readFileSync(subArg, 'utf8'));
  } else {
    subscription = JSON.parse(subArg);
  }
} catch (e) {
  console.error('Failed to parse subscription argument:', e.message);
  process.exit(1);
}

const payload = JSON.stringify({
  title: '🔥 Streak Tracker Pro: Direct Push Test',
  body: 'If you see this, background Push Notifications are operational!',
  icon: '/assets/icons/icon-192.png',
  badge: '/assets/icons/badge-72.png',
  data: { url: '/' }
});

console.log('Sending test push to endpoint:', subscription.endpoint);
webpush.sendNotification(subscription, payload)
  .then((result) => {
    console.log('Push notification sent successfully! HTTP Status:', result.statusCode);
  })
  .catch((err) => {
    console.error('Failed to send push notification:', err);
  });
