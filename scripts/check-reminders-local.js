// scripts/check-reminders-local.js
// Runs the reminder evaluation check directly from command line

require('dotenv').config();
const { handler } = require('../netlify/functions/check-reminders');

console.log('Running local check-reminders trigger...\n');

const cronSecret = process.env.CRON_SECRET;
const headers = cronSecret ? { authorization: `Bearer ${cronSecret}` } : {};

handler({ httpMethod: 'GET', headers }, {})
  .then((response) => {
    console.log('HTTP Status:', response.statusCode);
    const body = JSON.parse(response.body);
    console.log('Result:\n', JSON.stringify(body, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error running check-reminders:', err);
    process.exit(1);
  });
