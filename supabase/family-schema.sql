create table if not exists public.family_tasks (
  id text primary key,
  family_code text not null,
  category text not null,
  title text not null,
  description text,
  planned_minutes integer,
  actual_minutes integer,
  start_time text,
  end_time text,
  status text not null,
  repeat_type text not null,
  repeat_days integer[],
  start_date text not null,
  end_date text,
  auto_complete boolean not null default false,
  reward_points integer not null default 0,
  penalty_points integer not null default 0,
  overdue_points integer not null default 0,
  created_at text not null
);

create table if not exists public.family_exams (
  id text primary key,
  family_code text not null,
  subject text not null,
  exam_name text not null,
  score numeric not null,
  total_score numeric not null,
  average_score numeric,
  class_rank integer,
  grade_rank integer,
  exam_date text not null
);

create table if not exists public.family_badges (
  id text not null,
  family_code text not null,
  name text not null,
  description text not null,
  icon text not null,
  unlocked boolean not null default false,
  unlocked_at text,
  condition_type text not null,
  condition_value integer not null,
  primary key (family_code, id)
);

create table if not exists public.family_rewards (
  id text not null,
  family_code text not null,
  title text not null,
  description text,
  points_cost integer not null,
  icon text,
  enabled boolean not null default true,
  primary key (family_code, id)
);

create table if not exists public.family_ledger (
  id text primary key,
  family_code text not null,
  type text not null,
  points integer not null,
  reason text not null,
  created_at text not null
);

create table if not exists public.family_settings (
  id text not null,
  family_code text not null,
  child_name text not null,
  primary key (family_code, id)
);

create index if not exists family_tasks_family_code_idx on public.family_tasks (family_code);
create index if not exists family_exams_family_code_idx on public.family_exams (family_code);
create index if not exists family_ledger_family_code_idx on public.family_ledger (family_code);

alter table public.family_tasks enable row level security;
alter table public.family_exams enable row level security;
alter table public.family_badges enable row level security;
alter table public.family_rewards enable row level security;
alter table public.family_ledger enable row level security;
alter table public.family_settings enable row level security;

drop policy if exists "Anon can use family tasks" on public.family_tasks;
create policy "Anon can use family tasks" on public.family_tasks for all using (true) with check (true);

drop policy if exists "Anon can use family exams" on public.family_exams;
create policy "Anon can use family exams" on public.family_exams for all using (true) with check (true);

drop policy if exists "Anon can use family badges" on public.family_badges;
create policy "Anon can use family badges" on public.family_badges for all using (true) with check (true);

drop policy if exists "Anon can use family rewards" on public.family_rewards;
create policy "Anon can use family rewards" on public.family_rewards for all using (true) with check (true);

drop policy if exists "Anon can use family ledger" on public.family_ledger;
create policy "Anon can use family ledger" on public.family_ledger for all using (true) with check (true);

drop policy if exists "Anon can use family settings" on public.family_settings;
create policy "Anon can use family settings" on public.family_settings for all using (true) with check (true);

notify pgrst, 'reload schema';
