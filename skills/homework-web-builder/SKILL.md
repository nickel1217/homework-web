---
name: homework-web-builder
description: Build and modify the primary-school homework planning and check-in web app described by requirements.md. Use when implementing React/TypeScript/Vite features, Supabase family-code persistence, child-friendly Tailwind UI, Recharts statistics, JSON backup/import, GitHub Pages deployment, gamified points/badges/rewards, or Baidu Cloud OCR homework recognition for this project.
---

# Homework Web Builder

## Overview

Use this skill to keep implementation aligned with the product requirements for the homework planning app. Favor complete, runnable features with child-friendly interaction, Supabase family-code data storage, and clear boundaries around optional Baidu Cloud OCR.

## Workflow

1. Read `requirements.md` and `agent.md` before starting substantial work.
2. For product scope, read `references/product-brief.md`.
3. For OCR work, read `references/baidu-ocr.md` before designing or coding.
4. Identify whether the request is P0 or P1. Complete P0 foundations before P1 enhancements unless the user explicitly asks otherwise.
5. Implement visible, runnable behavior first; then refine structure and styling.
6. Verify the app after changes with typecheck/build/tests when available, and inspect responsive UI after frontend changes.

## Product Rules

- Treat the app as a family-only, single-child product.
- Store learning data in Supabase tables partitioned by `family_code`.
- Keep Baidu OCR credentials browser-local; do not upload OCR secrets to Supabase.
- Keep JSON export/import working as the backup and restore path.
- Avoid login, multi-child support, social features, rankings, and complex permissions for P0.
- Keep OCR optional and isolated so the core planning app still works when OCR fails.

## Technical Rules

- Use React, TypeScript strict mode, Vite, TailwindCSS, Recharts, Supabase, and GitHub Pages patterns.
- Prefer the repository's existing structure before adding new abstractions.
- Use the data models from `requirements.md` as the source of truth: `Task`, `ExamRecord`, `Badge`, and `Reward`.
- Add migrations or backward-compatible defaults when changing stored data.
- Keep state management simple and local unless a stronger pattern already exists in the codebase.

## UI Rules

- Optimize for iPad first, then desktop and landscape phone.
- Use large buttons, readable typography, high contrast, low text density, shallow navigation, cards, icons, and rewarding feedback.
- Use blue, purple, yellow, and green as accents without creating a single-hue interface.
- Avoid dark themes, enterprise admin styling, dense tables, complex menus, and text-heavy screens.

## Baidu Cloud OCR Rules

- Use Baidu Cloud OCR for homework recognition.
- Never hardcode or commit Baidu API keys, secret keys, or access tokens.
- Prefer a parent-owned proxy or serverless function to protect Baidu secrets.
- If the user requires GitHub Pages-only OCR, implement it as an explicit opt-in local credential setting with a visible risk warning.
- Convert OCR output into editable task drafts; do not silently create tasks without review.

## Verification

- Run available typecheck/build/test commands after code changes.
- For UI work, inspect at least one desktop and one iPad-like viewport; include landscape phone when changing layout/navigation.
- For persistence, verify create/read/update/delete and backup import/export paths.
- For points, rewards, badges, timers, and OCR parsing, test edge cases that can affect stored data.
