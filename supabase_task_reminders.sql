-- StreakUp v1.3: One-Time Task Reminders Table Migration
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- This creates the separate task_reminders table without touching streak_reminders.

CREATE TABLE IF NOT EXISTS task_reminders (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reminder_date TEXT NOT NULL,                  -- Format: YYYY-MM-DD (e.g. 2026-10-08)
    reminder_time TEXT NOT NULL,                  -- Format: HH:MM 24-hr (e.g. 11:00)
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',-- Default user timezone
    subscription JSONB NOT NULL,                  -- Web Push subscription payload
    notification_sent BOOLEAN DEFAULT false,      -- Prevents duplicate notifications
    reminder_sent BOOLEAN DEFAULT false,          -- Compatibility alias
    completed_at TIMESTAMP WITH TIME ZONE,        -- Set when completed if archived
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indices for fast scheduler lookups
CREATE INDEX IF NOT EXISTS idx_task_reminders_notif_sent ON task_reminders (notification_sent);
CREATE INDEX IF NOT EXISTS idx_task_reminders_sent ON task_reminders (reminder_sent);
CREATE INDEX IF NOT EXISTS idx_task_reminders_endpoint ON task_reminders (endpoint);
CREATE INDEX IF NOT EXISTS idx_task_reminders_date_time ON task_reminders (reminder_date, reminder_time);

-- Enable Row Level Security (RLS)
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;

-- Allow Netlify Functions using SERVICE ROLE KEY full access
CREATE POLICY "Service role full access on task_reminders"
    ON task_reminders
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
