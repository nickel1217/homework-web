# Agent Guide

## Project Summary

Build a Supabase-backed web app for a single primary-school child and family. The app helps the child record homework, manage study plans, track study time, earn points, redeem rewards, unlock badges, and review learning growth.

The product is not a generic task manager. Prioritize low-friction homework entry, positive feedback, habit formation, and parent-friendly visibility.

## Product Priorities

1. Keep the app simple, fun, and easy to continue using.
2. Prefer complete runnable features over placeholder screens.
3. Store learning data in Supabase by family sync code.
4. Favor iPad and touch-friendly usage, while supporting desktop and landscape phone layouts.
5. Avoid enterprise admin styling, dense tables, deep menus, and heavy text.

## Required Stack

- React
- TypeScript with strict mode
- Vite
- TailwindCSS
- shadcn/ui
- Recharts
- Supabase
- GitHub Pages deployment

## Architecture Rules

- Store study data in Supabase tables partitioned by `family_code`.
- Keep only sensitive browser-local settings, such as Baidu OCR credentials, in local browser storage.
- Do not introduce account systems, multi-child support, social features, ranking, or collaboration for P0.
- Support JSON export, JSON import, overwrite import, and merge import.
- Keep state management local and straightforward unless the codebase already establishes a stronger pattern.
- Prefer these directories:

```text
src/
  components/
  pages/
  hooks/
  stores/
  db/
  services/
  utils/
  types/
```

## P0 Scope

Implement these before P1 work:

- Study task CRUD
- Task timer
- Completion status management
- Points system
- Reward redemption
- Badge unlocking
- Study statistics charts
- Exam records
- Supabase persistence
- JSON import/export
- GitHub Pages deployment

## P1 Scope

P1 can follow after P0 is stable:

- OCR homework recognition
- AI task generation from OCR text
- Voice input
- PWA
- Push reminders
- Focus mode
- Animated feedback

## Baidu Cloud OCR Requirement

OCR homework recognition must connect to Baidu Cloud OCR.

Never hardcode Baidu `API Key`, `Secret Key`, or access tokens in committed source. A GitHub Pages-only frontend cannot safely protect a Baidu secret. Prefer one of these approaches:

1. A small user-owned proxy or serverless function that stores the Baidu secret outside the browser.
2. For family-only/local testing, an explicit local settings screen where the parent enters credentials, with clear in-app warning that browser-stored credentials are exposed to anyone using that browser.

Keep OCR optional and isolated in `src/services/ocr/` or an equivalent service boundary. OCR failures must not break the study planning app.

## Core Data Models

Use the models in `requirements.md` as the source of truth:

- `Task`
- `ExamRecord`
- `Badge`
- `Reward`

If extra fields are needed, keep them backward-compatible with JSON backup and migration.

## UI Direction

- Child-friendly education product.
- Large buttons, large readable type, high contrast, card-based layouts, few steps, and low text density.
- Use blue, purple, yellow, and green as accents without letting the UI become a one-color theme.
- Use icons and visual feedback for common actions.
- Use charts for growth and statistics.
- Avoid dark themes, complex menus, complex tables, and management-console patterns.

## Implementation Style

- Keep every change runnable.
- Build visible working features first, then refine structure.
- Avoid excessive abstraction and excessive file splitting.
- Add tests when shared logic, persistence, import/export, points, badges, timers, or OCR parsing behavior changes.
- Verify responsive layouts at iPad, desktop, and landscape phone widths after meaningful frontend changes.
