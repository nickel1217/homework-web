import { createClient } from "@supabase/supabase-js";
import type { AppSettings, BackupData, Badge, ExamRecord, PointLedger, Reward, Subject, Task } from "./types";

const SUPABASE_URL = "https://ufxmtxyziymozszkoajw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeG10eHl6aXltb3pzemtvYWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTE5MDAsImV4cCI6MjA5MzgyNzkwMH0.-Z9FZwTH7xx87BFKciVPkFtJMtb5k_FWrq-ofAeADwo";

export const DEFAULT_FAMILY_CODE = "nickel-homework-2026";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type TaskRow = {
  id: string;
  family_code: string;
  category: string;
  assignment_type?: string | null;
  title: string;
  description?: string | null;
  planned_minutes?: number | null;
  actual_minutes?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  status: Task["status"];
  repeat_type: Task["repeatType"];
  repeat_days?: number[] | null;
  start_date: string;
  end_date?: string | null;
  auto_complete: boolean;
  reward_points: number;
  penalty_points: number;
  overdue_points: number;
  created_at: string;
};

type ExamRow = {
  id: string;
  family_code: string;
  subject: string;
  exam_type?: string | null;
  grade?: string | null;
  semester?: string | null;
  exam_name: string;
  score: number;
  total_score: number;
  average_score?: number | null;
  class_rank?: number | null;
  grade_rank?: number | null;
  reward_points?: number | null;
  exam_date: string;
};

type BadgeRow = Badge & { family_code: string; unlocked_at?: string | null; condition_type: string; condition_value: number };
type RewardRow = Reward & { family_code: string; points_cost: number };
type LedgerRow = {
  id: string;
  family_code: string;
  type: PointLedger["type"];
  points: number;
  reason: string;
  created_at: string;
};
type SettingsRow = { id: string; family_code: string; child_name: string; parent_password?: string | null; badge_start_date?: string | null };
type SubjectRow = { id: string; family_code: string; name: string; color: string; show_on_home: boolean; sort_order: number };
type TaskDeletionRow = { family_code: string; task_id: string; created_at: string };
type TaskDailyPlanRow = { family_code: string; task_id: string; plan_date: string; planned_minutes: number; created_at: string };
type TaskPatch = Partial<Omit<Task, "endDate" | "startTime" | "endTime" | "repeatDays">> & {
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  repeatDays?: number[] | null;
};

const defaultSubjects: Array<Omit<SubjectRow, "family_code">> = [
  { id: "chinese", name: "语文", color: "#ef4444", show_on_home: true, sort_order: 1 },
  { id: "math", name: "数学", color: "#2563eb", show_on_home: true, sort_order: 2 },
  { id: "english", name: "英语", color: "#16a34a", show_on_home: true, sort_order: 3 },
  { id: "science", name: "科学", color: "#9333ea", show_on_home: true, sort_order: 4 },
  { id: "reading", name: "阅读", color: "#f59e0b", show_on_home: true, sort_order: 5 },
  { id: "other", name: "其他", color: "#0d9488", show_on_home: false, sort_order: 6 },
];

export async function fetchCloudData(familyCode: string): Promise<BackupData> {
  const [tasks, exams, badges, rewards, ledger, settings, subjects, taskDailyPlans] = await Promise.all([
    selectRows<TaskRow>("family_tasks", familyCode, "created_at", false),
    selectRows<ExamRow>("family_exams", familyCode, "exam_date", false),
    selectRows<BadgeRow>("family_badges", familyCode),
    selectRows<RewardRow>("family_rewards", familyCode),
    selectRows<LedgerRow>("family_ledger", familyCode, "created_at", false),
    selectRows<SettingsRow>("family_settings", familyCode),
    selectRows<SubjectRow>("family_subjects", familyCode, "sort_order"),
    selectRows<TaskDailyPlanRow>("family_task_daily_plans", familyCode, "plan_date"),
  ]);

  const dailyPlansByTask = new Map<string, Record<string, number>>();
  for (const plan of taskDailyPlans) {
    const taskPlans = dailyPlansByTask.get(plan.task_id) ?? {};
    taskPlans[plan.plan_date] = plan.planned_minutes;
    dailyPlansByTask.set(plan.task_id, taskPlans);
  }

  return {
    tasks: tasks.map((task) => fromTaskRow(task, dailyPlansByTask.get(task.id))),
    exams: exams.map(fromExamRow),
    badges: badges.map(fromBadgeRow),
    rewards: rewards.map(fromRewardRow),
    subjects: subjects.map(fromSubjectRow),
    ledger: ledger.map(fromLedgerRow),
    settings: settings.map(fromSettingsRow),
    exportedAt: new Date().toISOString(),
  };
}

export async function ensureCloudSeedData(familyCode: string) {
  const [{ count: badgeCount }, { count: rewardCount }, { count: settingsCount }, { count: subjectCount }] = await Promise.all([
    countRows("family_badges", familyCode),
    countRows("family_rewards", familyCode),
    countRows("family_settings", familyCode),
    countRows("family_subjects", familyCode),
  ]);

  if (!badgeCount) {
    await upsertRows(
      "family_badges",
      [
        {
          id: "first-task",
          name: "第一颗星",
          description: "完成第一个学习任务",
          icon: "Star",
          unlocked: false,
          condition_type: "completedTasks",
          condition_value: 1,
        },
        {
          id: "focus-60",
          name: "专注一小时",
          description: "累计学习 60 分钟",
          icon: "Clock",
          unlocked: false,
          condition_type: "studyMinutes",
          condition_value: 60,
        },
        {
          id: "task-10",
          name: "小小计划家",
          description: "累计完成 10 个任务",
          icon: "Trophy",
          unlocked: false,
          condition_type: "completedTasks",
          condition_value: 10,
        },
      ].map((badge) => ({ ...badge, family_code: familyCode })),
    );
  }

  if (!rewardCount) {
    await upsertRows(
      "family_rewards",
      [
        { id: "cartoon", title: "看一集动画", points_cost: 20, icon: "Tv", enabled: true },
        { id: "snack", title: "选择一个零食", points_cost: 30, icon: "Cookie", enabled: true },
        { id: "zoo", title: "动物园计划", points_cost: 120, icon: "Ticket", enabled: true },
      ].map((reward) => ({ ...reward, family_code: familyCode })),
    );
  }

  if (!settingsCount) {
    await upsertRows("family_settings", [{ id: "default", family_code: familyCode, child_name: "小朋友", parent_password: "admin", badge_start_date: new Date().toISOString().slice(0, 10) }]);
  }

  if (!subjectCount) {
    await upsertRows("family_subjects", defaultSubjects.map((subject) => ({ ...subject, family_code: familyCode })));
  }
}

export async function addCloudTask(familyCode: string, task: Task) {
  await upsertRows("family_tasks", [toTaskRow(familyCode, task)]);
}

export async function addCloudTasks(familyCode: string, tasks: Task[]) {
  await upsertRows("family_tasks", tasks.map((task) => toTaskRow(familyCode, task)));
}

export async function upsertCloudTaskDailyPlans(familyCode: string, plans: Array<{ taskId: string; planDate: string; plannedMinutes: number }>) {
  await upsertRows(
    "family_task_daily_plans",
    plans.map((plan) => ({
      family_code: familyCode,
      task_id: plan.taskId,
      plan_date: plan.planDate,
      planned_minutes: plan.plannedMinutes,
      created_at: new Date().toISOString(),
    })),
  );
}

export async function deleteCloudTaskDailyPlans(familyCode: string, taskId: string) {
  const { error } = await supabase.from("family_task_daily_plans").delete().eq("family_code", familyCode).eq("task_id", taskId);
  if (error) throw error;
}

export async function updateCloudTask(familyCode: string, id: string, changes: TaskPatch) {
  const { error } = await supabase.from("family_tasks").update(toTaskPatch(changes)).eq("family_code", familyCode).eq("id", id);
  if (error) throw error;
}

export async function deleteCloudTask(familyCode: string, id: string) {
  const { error } = await supabase.from("family_tasks").delete().eq("family_code", familyCode).eq("id", id);
  if (error) throw error;
}

export async function addCloudTaskDeletion(familyCode: string, taskId: string) {
  await upsertRows("family_task_deletions", [{ family_code: familyCode, task_id: taskId, created_at: new Date().toISOString() }]);
}

export async function fetchCloudTaskDeletionIds(familyCode: string) {
  const rows = await selectRows<TaskDeletionRow>("family_task_deletions", familyCode, "created_at", false);
  return new Set(rows.map((row) => row.task_id));
}

export async function addCloudExam(familyCode: string, exam: ExamRecord) {
  await upsertRows("family_exams", [toExamRow(familyCode, exam)]);
}

export async function updateCloudExam(familyCode: string, exam: ExamRecord) {
  await upsertRows("family_exams", [toExamRow(familyCode, exam)]);
}

export async function deleteCloudExam(familyCode: string, id: string) {
  const { error } = await supabase.from("family_exams").delete().eq("family_code", familyCode).eq("id", id);
  if (error) throw error;
}

export async function upsertCloudSubject(familyCode: string, subject: Subject) {
  await upsertRows("family_subjects", [toSubjectRow(familyCode, subject)]);
}

export async function deleteCloudSubject(familyCode: string, id: string) {
  const { error } = await supabase.from("family_subjects").delete().eq("family_code", familyCode).eq("id", id);
  if (error) throw error;
}

export async function addCloudLedger(familyCode: string, type: PointLedger["type"], points: number, reason: string) {
  await upsertRows("family_ledger", [
    {
      id: crypto.randomUUID(),
      family_code: familyCode,
      type,
      points,
      reason,
      created_at: new Date().toISOString(),
    },
  ]);
}

export async function deleteCloudLedger(familyCode: string, id: string) {
  const { error } = await supabase.from("family_ledger").delete().eq("family_code", familyCode).eq("id", id);
  if (error) throw error;
}

export async function upsertCloudReward(familyCode: string, reward: Reward) {
  await upsertRows("family_rewards", [toRewardRow(familyCode, reward)]);
}

export async function deleteCloudReward(familyCode: string, id: string) {
  const { error } = await supabase.from("family_rewards").delete().eq("family_code", familyCode).eq("id", id);
  if (error) throw error;
}

export async function upsertCloudBadge(familyCode: string, badge: Badge) {
  await upsertRows("family_badges", [toBadgeRow(familyCode, badge)]);
}

export async function deleteCloudBadge(familyCode: string, id: string) {
  const { error } = await supabase.from("family_badges").delete().eq("family_code", familyCode).eq("id", id);
  if (error) throw error;
}

export async function updateCloudSettings(familyCode: string, settings: AppSettings) {
  await upsertRows("family_settings", [{ id: settings.id, family_code: familyCode, child_name: settings.childName, parent_password: settings.parentPassword ?? "admin", badge_start_date: settings.badgeStartDate }]);
}

export async function restoreCloudBackup(familyCode: string, backup: BackupData, mode: "overwrite" | "merge") {
  if (mode === "overwrite") {
    await Promise.all([
      deleteFamilyRows("family_tasks", familyCode),
      deleteFamilyRows("family_exams", familyCode),
      deleteFamilyRows("family_badges", familyCode),
      deleteFamilyRows("family_rewards", familyCode),
      deleteFamilyRows("family_subjects", familyCode),
      deleteFamilyRows("family_ledger", familyCode),
      deleteFamilyRows("family_task_deletions", familyCode),
      deleteFamilyRows("family_task_daily_plans", familyCode),
      deleteFamilyRows("family_settings", familyCode),
    ]);
  }

  await Promise.all([
    upsertRows("family_tasks", backup.tasks.map((task) => toTaskRow(familyCode, task))),
    upsertRows("family_exams", backup.exams.map((exam) => toExamRow(familyCode, exam))),
    upsertRows("family_badges", backup.badges.map((badge) => toBadgeRow(familyCode, badge))),
    upsertRows("family_rewards", backup.rewards.map((reward) => toRewardRow(familyCode, reward))),
    upsertRows("family_subjects", (backup.subjects ?? []).map((subject) => toSubjectRow(familyCode, subject))),
    upsertRows("family_ledger", (backup.ledger ?? []).map((row) => toLedgerRow(familyCode, row))),
    upsertRows(
      "family_task_daily_plans",
      backup.tasks.flatMap((task) =>
        Object.entries(task.dailyPlans ?? {}).map(([planDate, plannedMinutes]) => ({
          family_code: familyCode,
          task_id: task.id,
          plan_date: planDate,
          planned_minutes: plannedMinutes,
          created_at: new Date().toISOString(),
        })),
      ),
    ),
    upsertRows("family_settings", backup.settings.map((setting) => ({ id: setting.id, family_code: familyCode, child_name: setting.childName, parent_password: setting.parentPassword ?? "admin", badge_start_date: setting.badgeStartDate }))),
  ]);
}

export function getPointBalance(ledger: PointLedger[]) {
  return ledger.reduce((sum, row) => sum + row.points, 0);
}

export type BadgeStats = Record<string, number>;

export function getBadgeRewardPoints(badge: Badge) {
  const value = Math.max(1, badge.conditionValue);
  const rewards: Record<string, number> = {
    completedTasks: Math.min(30, Math.max(2, Math.ceil(value / 5) * 2)),
    studyMinutes: Math.min(30, Math.max(3, Math.ceil(value / 60) * 3)),
    completedDays: Math.min(30, Math.max(3, Math.ceil(value / 3) * 3)),
    perfectDays: Math.min(36, Math.max(5, Math.ceil(value / 2) * 4)),
    consecutiveDays: Math.min(40, Math.max(6, value * 2)),
    examsAbove90: Math.min(30, Math.max(5, value * 5)),
    examsAbove95: Math.min(40, Math.max(8, value * 8)),
    pointsEarned: Math.min(30, Math.max(3, Math.ceil(value / 20) * 3)),
    currentPoints: Math.min(30, Math.max(3, Math.ceil(value / 30) * 3)),
    rewardsRedeemed: Math.min(30, Math.max(5, value * 5)),
  };
  return rewards[badge.conditionType] ?? 5;
}

export function getBadgeStats(tasks: Task[], exams: ExamRecord[] = [], ledger: PointLedger[] = [], startDate?: string): BadgeStats {
  const scopedTasks = startDate ? tasks.filter((task) => task.startDate >= startDate) : tasks;
  const scopedExams = startDate ? exams.filter((exam) => exam.examDate >= startDate) : exams;
  const scopedLedger = startDate ? ledger.filter((row) => getLocalDateText(row.createdAt) >= startDate) : ledger;
  const completedTasks = scopedTasks.filter((task) => task.status === "completed").length;
  const studyMinutes = scopedTasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);
  const completedDates = new Set(scopedTasks.filter((task) => task.status === "completed").map((task) => (task.endTime ? getLocalDateText(task.endTime) : task.startDate)));
  const tasksByDate = new Map<string, Task[]>();
  for (const task of scopedTasks) {
    const list = tasksByDate.get(task.startDate) ?? [];
    list.push(task);
    tasksByDate.set(task.startDate, list);
  }
  const perfectDays = [...tasksByDate.values()].filter((items) => items.length > 0 && items.every((task) => task.status === "completed")).length;
  const consecutiveDays = getLongestDateStreak([...completedDates]);
  const examsAbove90 = scopedExams.filter((exam) => formatExamPercent(exam) >= 90).length;
  const examsAbove95 = scopedExams.filter((exam) => formatExamPercent(exam) >= 95).length;
  const pointsEarned = scopedLedger.filter((row) => row.points > 0).reduce((sum, row) => sum + row.points, 0);
  const currentPoints = ledger.reduce((sum, row) => sum + row.points, 0);
  const rewardsRedeemed = scopedLedger.filter((row) => row.type === "spend").length;
  return { completedTasks, studyMinutes, completedDays: completedDates.size, perfectDays, consecutiveDays, examsAbove90, examsAbove95, pointsEarned, currentPoints, rewardsRedeemed };
}

export async function refreshCloudBadges(
  familyCode: string,
  tasks: Task[],
  badges: Badge[],
  exams: ExamRecord[] = [],
  ledger: PointLedger[] = [],
  startDate?: string,
) {
  const stats = getBadgeStats(tasks, exams, ledger, startDate);
  const unlockedAt = new Date().toISOString();
  const toUnlock = badges.filter((badge) => !badge.unlocked && (stats[badge.conditionType] ?? 0) >= badge.conditionValue);

  if (toUnlock.length === 0) return;

  await upsertRows(
    "family_ledger",
    toUnlock.map((badge) => ({
      id: `badge-reward:${familyCode}:${badge.id}`,
      family_code: familyCode,
      type: "earn",
      points: getBadgeRewardPoints(badge),
      reason: `解锁成就：${badge.name}`,
      created_at: unlockedAt,
    })),
  );
  const unlockResults = await Promise.all(
    toUnlock.map((badge) =>
      supabase.from("family_badges").update({ unlocked: true, unlocked_at: unlockedAt }).eq("family_code", familyCode).eq("id", badge.id),
    ),
  );
  const unlockError = unlockResults.find((result) => result.error)?.error;
  if (unlockError) throw unlockError;
}

function getLongestDateStreak(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  let longest = 0;
  let current = 0;
  let previous = "";
  for (const date of sorted) {
    current = previous && addUtcDays(previous, 1) === date ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getLocalDateText(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function selectRows<T>(table: string, familyCode: string, order?: string, ascending = true): Promise<T[]> {
  let query = supabase.from(table).select("*").eq("family_code", familyCode);
  if (order) query = query.order(order, { ascending });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

async function countRows(table: string, familyCode: string) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("family_code", familyCode);
  if (error) throw error;
  return { count: count ?? 0 };
}

async function upsertRows(table: string, rows: object[]) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows);
  if (error) throw error;
}

async function deleteFamilyRows(table: string, familyCode: string) {
  const { error } = await supabase.from(table).delete().eq("family_code", familyCode);
  if (error) throw error;
}

function fromTaskRow(row: TaskRow, dailyPlans?: Record<string, number>): Task {
  return {
    id: row.id,
    category: row.category,
    assignmentType: (row.assignment_type as Task["assignmentType"]) ?? "课外作业",
    title: row.title,
    description: row.description ?? undefined,
    plannedMinutes: row.planned_minutes ?? undefined,
    actualMinutes: row.actual_minutes ?? undefined,
    dailyPlans,
    startTime: row.start_time || undefined,
    endTime: row.end_time || undefined,
    status: row.status,
    repeatType: row.repeat_type,
    repeatDays: row.repeat_days ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    autoComplete: row.auto_complete,
    rewardPoints: row.reward_points,
    penaltyPoints: row.penalty_points,
    overduePoints: row.overdue_points,
    createdAt: row.created_at,
  };
}

function toTaskRow(familyCode: string, task: Task): TaskRow {
  return {
    id: task.id,
    family_code: familyCode,
    category: task.category,
    assignment_type: task.assignmentType ?? "课外作业",
    title: task.title,
    description: task.description,
    planned_minutes: task.plannedMinutes,
    actual_minutes: task.actualMinutes,
    start_time: task.startTime,
    end_time: task.endTime,
    status: task.status,
    repeat_type: task.repeatType,
    repeat_days: task.repeatDays,
    start_date: task.startDate,
    end_date: task.endDate,
    auto_complete: task.autoComplete,
    reward_points: task.rewardPoints,
    penalty_points: task.penaltyPoints,
    overdue_points: task.overduePoints,
    created_at: task.createdAt,
  };
}

function toTaskPatch(task: TaskPatch) {
  return compact({
    category: task.category,
    assignment_type: task.assignmentType,
    title: task.title,
    description: task.description,
    planned_minutes: task.plannedMinutes,
    actual_minutes: task.actualMinutes,
    start_time: task.startTime,
    end_time: task.endTime,
    status: task.status,
    repeat_type: task.repeatType,
    repeat_days: task.repeatDays,
    start_date: task.startDate,
    end_date: task.endDate,
    auto_complete: task.autoComplete,
    reward_points: task.rewardPoints,
    penalty_points: task.penaltyPoints,
    overdue_points: task.overduePoints,
    created_at: task.createdAt,
  });
}

function fromExamRow(row: ExamRow): ExamRecord {
  return {
    id: row.id,
    subject: row.subject,
    examType: row.exam_type ?? "单元测试",
    grade: row.grade ?? "三年级",
    semester: row.semester ?? "下学期",
    examName: row.exam_name,
    score: row.score,
    totalScore: row.total_score,
    averageScore: row.average_score ?? undefined,
    classRank: row.class_rank ?? undefined,
    gradeRank: row.grade_rank ?? undefined,
    rewardPoints: row.reward_points ?? 0,
    examDate: row.exam_date,
  };
}

function toExamRow(familyCode: string, exam: ExamRecord): ExamRow {
  return {
    id: exam.id,
    family_code: familyCode,
    subject: exam.subject,
    exam_type: exam.examType,
    grade: exam.grade,
    semester: exam.semester,
    exam_name: exam.examName,
    score: exam.score,
    total_score: exam.totalScore,
    average_score: exam.averageScore,
    class_rank: exam.classRank,
    grade_rank: exam.gradeRank,
    reward_points: exam.rewardPoints,
    exam_date: exam.examDate,
  };
}

function fromBadgeRow(row: BadgeRow): Badge {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    unlocked: row.unlocked,
    unlockedAt: row.unlocked_at ?? undefined,
    conditionType: row.condition_type,
    conditionValue: row.condition_value,
  };
}

function toBadgeRow(familyCode: string, badge: Badge) {
  return {
    id: badge.id,
    family_code: familyCode,
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    unlocked: badge.unlocked,
    unlocked_at: badge.unlockedAt,
    condition_type: badge.conditionType,
    condition_value: badge.conditionValue,
  };
}

function fromRewardRow(row: RewardRow): Reward {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pointsCost: row.points_cost,
    icon: row.icon,
    enabled: row.enabled,
  };
}

function fromLedgerRow(row: LedgerRow): PointLedger {
  return {
    id: row.id,
    type: row.type,
    points: row.points,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function toLedgerRow(familyCode: string, row: PointLedger): LedgerRow {
  return {
    id: row.id,
    family_code: familyCode,
    type: row.type,
    points: row.points,
    reason: row.reason,
    created_at: row.createdAt,
  };
}

function formatExamPercent(exam: ExamRecord) {
  if (!exam.totalScore) return 0;
  return Math.round((exam.score / exam.totalScore) * 100);
}

function toRewardRow(familyCode: string, reward: Reward) {
  return {
    id: reward.id,
    family_code: familyCode,
    title: reward.title,
    description: reward.description,
    points_cost: reward.pointsCost,
    icon: reward.icon,
    enabled: reward.enabled,
  };
}

function fromSettingsRow(row: SettingsRow): AppSettings {
  return {
    id: row.id,
    childName: row.child_name,
    parentPassword: row.parent_password ?? "admin",
    badgeStartDate: row.badge_start_date ?? undefined,
  };
}

function fromSubjectRow(row: SubjectRow): Subject {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    showOnHome: row.show_on_home,
    sortOrder: row.sort_order,
  };
}

function toSubjectRow(familyCode: string, subject: Subject): SubjectRow {
  return {
    id: subject.id,
    family_code: familyCode,
    name: subject.name,
    color: subject.color,
    show_on_home: subject.showOnHome,
    sort_order: subject.sortOrder,
  };
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
