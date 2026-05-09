import Dexie, { type Table } from "dexie";
import type { AppSettings, Badge, ExamRecord, PointLedger, Reward, Task } from "./types";

class HomeworkDatabase extends Dexie {
  tasks!: Table<Task, string>;
  exams!: Table<ExamRecord, string>;
  badges!: Table<Badge, string>;
  rewards!: Table<Reward, string>;
  settings!: Table<AppSettings, string>;
  ledger!: Table<PointLedger, string>;

  constructor() {
    super("homework-web-db");
    this.version(1).stores({
      tasks: "id, status, category, startDate, createdAt",
      exams: "id, subject, examDate",
      badges: "id, unlocked, conditionType",
      rewards: "id, enabled, pointsCost",
      settings: "id",
      ledger: "id, type, createdAt",
    });
  }
}

export const db = new HomeworkDatabase();

const nowIso = () => new Date().toISOString();

export async function ensureSeedData() {
  const [badgeCount, rewardCount, settingsCount] = await Promise.all([
    db.badges.count(),
    db.rewards.count(),
    db.settings.count(),
  ]);

  if (badgeCount === 0) {
    await db.badges.bulkAdd([
      {
        id: "first-task",
        name: "第一颗星",
        description: "完成第一个学习任务",
        icon: "Star",
        unlocked: false,
        conditionType: "completedTasks",
        conditionValue: 1,
      },
      {
        id: "focus-60",
        name: "专注一小时",
        description: "累计学习 60 分钟",
        icon: "Clock",
        unlocked: false,
        conditionType: "studyMinutes",
        conditionValue: 60,
      },
      {
        id: "task-10",
        name: "小小计划家",
        description: "累计完成 10 个任务",
        icon: "Trophy",
        unlocked: false,
        conditionType: "completedTasks",
        conditionValue: 10,
      },
    ]);
  }

  if (rewardCount === 0) {
    await db.rewards.bulkAdd([
      { id: "cartoon", title: "看一集动画", pointsCost: 20, icon: "Tv", enabled: true },
      { id: "snack", title: "选择一个零食", pointsCost: 30, icon: "Cookie", enabled: true },
      { id: "zoo", title: "动物园计划", pointsCost: 120, icon: "Ticket", enabled: true },
    ]);
  }

  if (settingsCount === 0) {
    await db.settings.add({ id: "default", childName: "小朋友" });
  }
}

export async function addLedger(type: PointLedger["type"], points: number, reason: string) {
  await db.ledger.add({
    id: crypto.randomUUID(),
    type,
    points,
    reason,
    createdAt: nowIso(),
  });
}

export async function getPointBalance() {
  const rows = await db.ledger.toArray();
  return rows.reduce((sum, row) => sum + row.points, 0);
}

export async function refreshBadges() {
  const [tasks, badges] = await Promise.all([db.tasks.toArray(), db.badges.toArray()]);
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const studyMinutes = tasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);
  const stats: Record<string, number> = { completedTasks, studyMinutes };
  const updates = badges
    .filter((badge) => !badge.unlocked && (stats[badge.conditionType] ?? 0) >= badge.conditionValue)
    .map((badge) => ({
      key: badge.id,
      changes: { unlocked: true, unlockedAt: nowIso() },
    }));

  if (updates.length > 0) {
    await db.transaction("rw", db.badges, db.ledger, async () => {
      for (const update of updates) {
        await db.badges.update(update.key, update.changes);
        await addLedger("earn", 5, `解锁勋章：${badges.find((item) => item.id === update.key)?.name ?? "新勋章"}`);
      }
    });
  }
}
