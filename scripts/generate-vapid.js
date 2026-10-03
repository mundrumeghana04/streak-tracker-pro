// scripts/generate-vapid.js
// Generates fresh VAPID keys for Web Push

const webpush = require('web-push');

console.log('Generating new VAPID Key Pair for Streak Tracker Pro...\n');
const vapidKeys = webpush.generateVAPIDKeys();

console.log('================================================================');
console.log('                 NEW VAPID KEYS GENERATED                       ');
console.log('================================================================');
console.log('\nPUBLIC KEY (used in frontend and server):');
console.log(vapidKeys.publicKey);

console.log('\nPRIVATE KEY (KEEP SECRET - Server only, NEVER commit to GitHub):');
console.log(vapidKeys.privateKey);

console.log('\n================================================================');
console.log('Copy the lines below into your .env file or Netlify Environment:');
console.log('================================================================');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@streaktracker.pro`);
console.log('================================================================\n');
