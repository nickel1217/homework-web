create table if not exists public.app_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.app_backups enable row level security;

drop policy if exists "Users can read own backup" on public.app_backups;
create policy "Users can read own backup"
on public.app_backups for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own backup" on public.app_backups;
create policy "Users can insert own backup"
on public.app_backups for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own backup" on public.app_backups;
create policy "Users can update own backup"
on public.app_backups for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
