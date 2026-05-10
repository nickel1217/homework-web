create table if not exists public.family_tasks (
  id text primary key,
  family_code text not null,
  category text not null,
  assignment_type text not null default '课外作业',
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
  exam_type text not null default '单元测试',
  grade text not null default '三年级',
  semester text not null default '下学期',
  exam_name text not null,
  score numeric not null,
  total_score numeric not null,
  average_score numeric,
  class_rank integer,
  grade_rank integer,
  reward_points integer not null default 0,
  exam_date text not null
);

alter table public.family_tasks add column if not exists assignment_type text not null default '课外作业';
alter table public.family_exams add column if not exists exam_type text not null default '单元测试';
alter table public.family_exams add column if not exists grade text not null default '三年级';
alter table public.family_exams add column if not exists semester text not null default '下学期';
alter table public.family_exams add column if not exists reward_points integer not null default 0;

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

create table if not exists public.family_subjects (
  id text not null,
  family_code text not null,
  name text not null,
  color text not null,
  show_on_home boolean not null default true,
  sort_order integer not null default 0,
  primary key (family_code, id),
  unique (family_code, name)
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
  parent_password text not null default 'admin',
  badge_start_date date,
  primary key (family_code, id)
);

alter table public.family_settings add column if not exists parent_password text not null default 'admin';
alter table public.family_settings add column if not exists badge_start_date date;

create index if not exists family_tasks_family_code_idx on public.family_tasks (family_code);
create index if not exists family_exams_family_code_idx on public.family_exams (family_code);
create index if not exists family_ledger_family_code_idx on public.family_ledger (family_code);
create index if not exists family_subjects_family_code_idx on public.family_subjects (family_code);

create or replace function public.skip_future_repeat_task_instances()
returns trigger
language plpgsql
as $$
begin
  if new.id like 'repeat:%'
     and new.repeat_type = 'none'
     and new.start_date > to_char((now() at time zone 'Asia/Shanghai')::date, 'YYYY-MM-DD') then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists skip_future_repeat_task_instances on public.family_tasks;
create trigger skip_future_repeat_task_instances
before insert on public.family_tasks
for each row execute function public.skip_future_repeat_task_instances();

alter table public.family_tasks enable row level security;
alter table public.family_exams enable row level security;
alter table public.family_badges enable row level security;
alter table public.family_rewards enable row level security;
alter table public.family_subjects enable row level security;
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

drop policy if exists "Anon can use family subjects" on public.family_subjects;
create policy "Anon can use family subjects" on public.family_subjects for all using (true) with check (true);

drop policy if exists "Anon can use family ledger" on public.family_ledger;
create policy "Anon can use family ledger" on public.family_ledger for all using (true) with check (true);

drop policy if exists "Anon can use family settings" on public.family_settings;
create policy "Anon can use family settings" on public.family_settings for all using (true) with check (true);

notify pgrst, 'reload schema';
