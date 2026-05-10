export type TaskStatus = "pending" | "running" | "paused" | "completed" | "expired";
export type RepeatType = "none" | "daily" | "weekly";
export type AssignmentType = "课堂作业" | "课外作业";

export type Task = {
  id: string;
  category: string;
  assignmentType?: AssignmentType;
  title: string;
  description?: string;
  plannedMinutes?: number;
  actualMinutes?: number;
  startTime?: string;
  endTime?: string;
  status: TaskStatus;
  repeatType: RepeatType;
  repeatDays?: number[];
  startDate: string;
  endDate?: string;
  autoComplete: boolean;
  rewardPoints: number;
  penaltyPoints: number;
  overduePoints: number;
  createdAt: string;
};

export type ExamRecord = {
  id: string;
  subject: string;
  examType?: string;
  grade?: string;
  semester?: string;
  examName: string;
  score: number;
  totalScore: number;
  averageScore?: number;
  classRank?: number;
  gradeRank?: number;
  rewardPoints?: number;
  examDate: string;
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  conditionType: string;
  conditionValue: number;
};

export type Reward = {
  id: string;
  title: string;
  description?: string;
  pointsCost: number;
  icon?: string;
  enabled: boolean;
};

export type Subject = {
  id: string;
  name: string;
  color: string;
  showOnHome: boolean;
  sortOrder: number;
};

export type PointLedger = {
  id: string;
  type: "earn" | "spend" | "adjust";
  points: number;
  reason: string;
  createdAt: string;
};

export type AppSettings = {
  id: string;
  childName: string;
  parentPassword?: string;
  badgeStartDate?: string;
  baiduOcr?: {
    mode: "proxy" | "local";
    proxyUrl?: string;
    apiKey?: string;
    secretKey?: string;
  };
};

export type BackupData = {
  tasks: Task[];
  exams: ExamRecord[];
  badges: Badge[];
  rewards: Reward[];
  subjects?: Subject[];
  settings: AppSettings[];
  ledger?: PointLedger[];
  exportedAt?: string;
};
