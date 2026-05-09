import { db } from "./db";
import type { BackupData } from "./types";

type BackupOptions = {
  includeSecrets?: boolean;
};

export async function createBackup(options: BackupOptions = {}): Promise<BackupData> {
  const [tasks, exams, badges, rewards, settings, ledger] = await Promise.all([
    db.tasks.toArray(),
    db.exams.toArray(),
    db.badges.toArray(),
    db.rewards.toArray(),
    db.settings.toArray(),
    db.ledger.toArray(),
  ]);

  return {
    tasks,
    exams,
    badges,
    rewards,
    settings: options.includeSecrets === false ? stripSecrets(settings) : settings,
    ledger,
    exportedAt: new Date().toISOString(),
  };
}

export async function restoreBackup(data: BackupData, mode: "overwrite" | "merge") {
  await db.transaction("rw", [db.tasks, db.exams, db.badges, db.rewards, db.settings, db.ledger], async () => {
    if (mode === "overwrite") {
      await Promise.all([
        db.tasks.clear(),
        db.exams.clear(),
        db.badges.clear(),
        db.rewards.clear(),
        db.settings.clear(),
        db.ledger.clear(),
      ]);
    }

    await Promise.all([
      db.tasks.bulkPut(data.tasks ?? []),
      db.exams.bulkPut(data.exams ?? []),
      db.badges.bulkPut(data.badges ?? []),
      db.rewards.bulkPut(data.rewards ?? []),
      db.settings.bulkPut(data.settings ?? []),
      db.ledger.bulkPut(data.ledger ?? []),
    ]);
  });
}

function stripSecrets(settings: BackupData["settings"]) {
  return settings.map((item) => {
    if (item.baiduOcr?.mode !== "local") return item;
    return {
      ...item,
      baiduOcr: {
        mode: "local" as const,
        apiKey: "",
        secretKey: "",
      },
    };
  });
}
