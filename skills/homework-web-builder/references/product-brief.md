# Product Brief

## One-Line Goal

Create a GitHub Pages-deployed study planning and check-in web app for one primary-school child, using Supabase family-code storage for cross-device data.

## Users

- Child: records homework, starts timers, completes tasks, earns points, unlocks badges, redeems rewards.
- Parent: configures tasks and rewards, reviews progress, imports/exports backups, may configure OCR credentials.

## P0 Feature Set

- Dashboard with today's study time, today's task count, completion rate, points, recent score trend, and recent badges.
- Study plan page with task CRUD, task completion, and timer.
- Exam record page with score entry, list, and trends.
- Statistics page with study time, completion rate, category time share, planned vs actual time, and streak trends.
- Badge wall with unlocked and locked badges.
- Points and rewards page with reward redemption and points ledger.
- Supabase persistence through a family sync code.
- JSON backup export/import with overwrite and merge modes.
- GitHub Pages deployment.

## P1 Feature Set

- Baidu Cloud OCR homework recognition.
- AI task generation from OCR text.
- Voice input.
- PWA.
- Push reminders.
- Focus mode.
- Animated feedback.

## Non-Goals For P0

- User login.
- Multiple children.
- Account login.
- Parent approval workflow.
- Social features.
- Rankings.
- Multi-user collaboration.

## UX Principles

- Optimize for iPad first, then desktop and landscape phone.
- Use touch-friendly controls, big typography, high contrast, and shallow navigation.
- Make child progress feel rewarding through points, badges, streaks, and completion feedback.
- Avoid enterprise dashboards, dense tables, dark themes, and complex configuration flows.
