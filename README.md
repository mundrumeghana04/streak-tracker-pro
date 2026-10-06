# 🔥 StreakUp (v1.3.1)

> **Build consistency. Level up every day.**

A modern habit tracking and task reminder Progressive Web Application (PWA) built with HTML, CSS, JavaScript, and a **real background scheduled Web Push notification system**.

Reminders are delivered directly to your device even when the website tab or browser is closed.

---

## 🚀 Key Features

### 1. 🔥 Daily Habits & Streaks (Recurring)
- **Habit Tracking**: Track individual habit streaks and celebrate personal bests.
- **Target & Unlimited Goals**:
  - *Target Goals*: Visual progress bar towards a set target (e.g., 30 days). Automatically completes and stops reminders upon achievement.
  - *Unlimited Goals*: Infinite habit building with no percentage cap.
- **Recurring Daily Reminders**:
  - Optional daily reminder per goal (e.g., 7:30 PM).
  - Skips notifications if the goal was already marked "Completed Today".
  - Dynamic motivational copy tailored to task title and category (Study, Coding, Fitness, Reading, etc.).
  - Deduplication: Strictly sends at most once per scheduled occurrence per day.

### 2. ⏰ Task Reminders (One-Time Alerts) — *NEW in v1.3*
- **One-Time Event Scheduling**: Distinct, separate reminders for assignments, meetings, deadlines, and appointments.
- **Date & Time Precision**: Set exact date and time (e.g., *Oct 6, 2026 at 5:00 PM*).
- **Status Indicators**:
  - `🟢 Upcoming`: Active future alerts.
  - `🟠 Overdue`: Past scheduled alerts that have not yet been marked completed.
- **Exactly-Once Background Push**: Fires exactly one Web Push notification when the scheduled date and time arrives, even with the website closed.
- **Permanent Deletion on Completion**: Clicking `✓ Mark Completed` permanently deletes the record from the Supabase database and UI immediately (does not affect habit streaks).
- **Edit & Reschedule**: Changing date or time automatically resets the delivery flag so the new time triggers properly.

### 3. 📱 PWA & Offline Support
- **Progressive Web App (PWA)**: Installable on Windows, macOS, Android, and iOS.
- **Offline Reliability**: Caches the app shell with Service Worker (`sw.js`).
- **Dark & Light Mode**: Seamless theme switching with saved preference.
- **Search & Filter**: Real-time keyword filtering.
- **Backup & Restore**: Export and import full JSON backups (with seamless migration for goals and task reminders).
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
          │  5. 5-minute scheduler evaluates pending reminders
          │  6. Validates: NOT completed today & scheduled time reached
          ▼
[ Web Push Service (FCM / APNs) ]
          │  7. Encrypted push dispatched with VAPID authentication
          ▼
[ Service Worker (sw.js) ]
          │  8. push event wakes up background service worker
          │  9. showNotification() displays native OS toast
          │ 10. Clicking notification focuses or opens StreakUp
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
- **Database**: Supabase PostgreSQL (`streak_reminders` and `task_reminders` tables)
- **Deployment**: Netlify & GitHub


---

## ⚙️ Configuration & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm start
```
Opens local PWA server with simulated Netlify functions at `http://localhost:3000`.

### 3. Set Up Supabase Database (Free Tier)
1. In your Supabase dashboard, open the **SQL Editor**.
2. For fresh installs, run [`supabase_schema.sql`](supabase_schema.sql).
3. If upgrading from v1.1 or v1.2, run [`supabase_task_reminders.sql`](supabase_task_reminders.sql) to add the `task_reminders` table without touching your existing `streak_reminders` habits table.
4. Under **Project Settings** → **API**, copy your **Project URL** and **Service Role Secret**.

### 4. Configure Environment Variables
Create a `.env` file in the project root:
```env
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@streaktracker.pro

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

CRON_SECRET=streak_tracker_cron_secret_key_123
```

---

## 🚀 Deployment to Netlify

### Netlify Environment Variables
In your Netlify site dashboard under **Site configuration** → **Environment variables**:
1. `VAPID_PUBLIC_KEY`
2. `VAPID_PRIVATE_KEY`
3. `VAPID_SUBJECT`
4. `SUPABASE_URL`
5. `SUPABASE_SERVICE_ROLE_KEY`
6. `CRON_SECRET`

### Deploying via Git
```bash
git add .
git commit -m "feat: Upgrade to StreakUp v1.3 with separate one-time task reminders system"
git push origin main
```
Netlify will automatically detect `netlify.toml`, build the functions, and deploy the PWA.

---

## 🧪 Verification & Testing

Run the comprehensive automated test suite locally:
```bash
npm test
```
This runs both:
- Habit streak scheduler logic tests (`scripts/test-scheduler-logic.js`)
- One-time task reminders lifecycle & push tests (`scripts/test-one-time-reminders.js`)

---

## 📄 License
MIT © Mundru Meghana
