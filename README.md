# 🔥 Streak Tracker Pro (v1.1)

A responsive habit and goal tracking Progressive Web Application (PWA) built with HTML, CSS, JavaScript, and a **real background scheduled Web Push notification system**.

Reminders are delivered directly to your device even when the website tab or browser is closed.

---

## 🚀 Key Features

- **Daily Streak Tracking**: Track individual habit streaks and celebrate milestones.
- **Target & Unlimited Goals**:
  - *Target Goals*: Visual progress bar towards a set target (e.g., 30 days). Automatically completes and stops reminders upon achievement.
  - *Unlimited Goals*: Infinite habit building with no percentage cap.
- **Real Background Push Reminders**:
  - Optional daily reminder per goal (e.g. 7:00 PM).
  - Background delivery via Web Push API and Service Worker — **does not require the website tab to be kept open**.
  - Smart delivery: Automatically skips notifications if the goal was already marked "Completed Today".
  - Dynamic motivational copy tailored to task title and category (Study, Coding, Fitness, Reading, etc.).
  - Deduplication: Strictly sends at most once per scheduled occurrence per day.
- **Progressive Web App (PWA)**:
  - Installable on desktop and mobile.
  - Full offline capability with cached app shell.
- **Categories & Priorities**: Organize by Study, Fitness, Health, Reading, Coding, Meditation, Work, etc.
- **Daily Notes**: Keep dated reflections and logs for each habit.
- **Dark & Light Mode**: Seamless theme switching with saved preference.
- **Search & Filter**: Real-time keyword filtering.
- **Backup & Restore**: Export and import full JSON backups (with automatic migration for backwards compatibility).
- **Timezone Aware**: Automatically detects your local timezone (e.g., `Asia/Kolkata`) with worldwide compatibility.

---

## 🏗 Notification Architecture

```text
[ Browser / Installed PWA ]
          │  1. Requests permission & registers sw.js
          │  2. Subscribes via PushManager with VAPID Public Key
          │  3. Syncs reminder schedule to Netlify Function
          ▼
[ Netlify Functions + Supabase Database ]
          │  4. Stores active reminder & push subscription
          │  5. Hourly scheduler evaluates pending reminders
          │  6. Validates: NOT completed today & scheduled time reached
          ▼
[ Web Push Service (FCM / APNs) ]
          │  7. Encrypted push dispatched with VAPID authentication
          ▼
[ Service Worker (sw.js) ]
          │  8. push event wakes up background service worker
          │  9. showNotification() displays native OS toast
          │ 10. Clicking notification focuses or opens Streak Tracker Pro
```

### Browser & OS Behavior Summary

| Scenario | Delivery Status | Details |
| :--- | :--- | :--- |
| **Tab Closed, Browser Open** | **Delivered** | Browser background process receives push and triggers `sw.js`. |
| **Browser Closed (Windows)** | **Delivered** | Delivered if browser background apps enabled (default on Chrome/Edge). |
| **Browser Closed (Android)** | **Delivered** | Android system push (FCM) launches service worker in the background. |
| **macOS (Safari / Chrome)** | **Delivered** | Safari (macOS 13+) handles web push natively at OS level via APNs. |
| **iOS / iPadOS (iPhone / iPad)** | **Delivered as PWA** | Apple requires "Add to Home Screen" (iOS 16.4+) for Web Push notifications. |
| **Device Offline** | **Queued** | Vendor push service holds notification and delivers immediately upon reconnection. |
| **Permission Denied** | **Blocked** | Browser rejects push. The UI presents instructions to re-enable in browser settings. |

---

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, Modern CSS (Glassmorphism, CSS Variables, Flexbox/Grid)
- **Offline / PWA**: Web App Manifest (`manifest.json`), Service Worker (`sw.js`), Cache API
- **Push Pipeline**: Web Push API, Notification API, `web-push` library with RFC 8292 VAPID
- **Serverless Backend**: Netlify Functions (`netlify/functions/`)
- **Database**: Supabase PostgreSQL (`streak_reminders` table)
- **Deployment**: Netlify & GitHub

---

## ⚙️ Configuration & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate VAPID Keys
Run the included generator to create your unique VAPID public and private key pair:
```bash
npm run generate-vapid
```

### 3. Set Up Supabase Database (Free Tier)
1. Go to [https://supabase.com](https://supabase.com) and create a free project.
2. In your Supabase dashboard, open the **SQL Editor**.
3. Copy and run the entire script in [`supabase_schema.sql`](supabase_schema.sql).
4. Go to **Project Settings** → **API** and copy:
   - **Project URL**
   - **Service Role Secret** (keep this confidential)

### 4. Configure Environment Variables
Create a `.env` file in the project root (copied from `.env.example`):
```env
VAPID_PUBLIC_KEY=your_generated_public_key
VAPID_PRIVATE_KEY=your_generated_private_key
VAPID_SUBJECT=mailto:admin@streaktracker.pro

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

CRON_SECRET=your_custom_secret_for_cron
```

---

## 🚀 Deployment to Netlify

### Netlify Environment Variables
In your Netlify site dashboard under **Site configuration** → **Environment variables**, add:
1. `VAPID_PUBLIC_KEY`
2. `VAPID_PRIVATE_KEY`
3. `VAPID_SUBJECT`
4. `SUPABASE_URL`
5. `SUPABASE_SERVICE_ROLE_KEY`
6. `CRON_SECRET`

### Deploying via Git
```bash
git add .
git commit -m "Upgrade to v1.1: PWA, scheduled background push notifications, and Netlify Functions"
git push origin main
```
Netlify will automatically detect `netlify.toml`, build the functions, and deploy the PWA.

### Setting up Cron Triggers
- **Option A (Netlify Scheduled Functions)**: Pre-configured in `netlify.toml` with `@hourly`.
- **Option B (Minute-by-minute with cron-job.org / GitHub Actions)**:
  Configure a free job on [cron-job.org](https://cron-job.org) targeting:
  `https://your-site.netlify.app/.netlify/functions/check-reminders?secret=YOUR_CRON_SECRET`
  running every 5, 10, or 15 minutes.

---

## 🧪 Verification & Testing

Run the automated test suite locally:
```bash
node scripts/test-scheduler-logic.js
```

### Manual Verification Checklist
1. **TEST 1 (Subscription)**: Create a goal with "Enable Daily Reminder" checked. Grant notification permission. Verify button displays `🔔 Notifications: Enabled`.
2. **TEST 2 (Test Alert)**: Click the **🧪 Test Push** button in the header. Verify the push notification appears on your device screen.
3. **TEST 3 (Completed Today)**: Mark the goal as "Complete Today". Verify that `lastCompleted` updates and the reminder is skipped for today.
4. **TEST 4 (Independent Goals)**: Create two goals with different reminder times (e.g. 07:00 and 19:00). Verify each goal card displays its independent pill.
5. **TEST 5 (Closed Tab)**: Close the browser tab. Trigger the reminder check. Verify the native push notification displays without the site open.
6. **TEST 6 (Persistence)**: Refresh the page. Verify all tasks, streaks, notes, and reminder settings remain intact.
7. **TEST 7 (Legacy Import)**: Import an older `streak-backup.json`. Verify tasks import cleanly with safe notification defaults.
8. **TEST 8 (Export)**: Export a backup. Verify the downloaded JSON file contains the new reminder properties.
9. **TEST 9 (Themes)**: Toggle Dark and Light mode. Verify reminder badges, pills, and inputs adapt their contrast and colors.
10. **TEST 10 (PWA Install)**: Click the browser's install icon. Launch the standalone application and verify notification reception.

---

## 📄 License
MIT © Mundru Meghana
