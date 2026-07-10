import {
  Award,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CloudSun,
  Cookie,
  Download,
  Gift,
  GraduationCap,
  Gamepad2,
  Home,
  IceCreamBowl,
  Leaf,
  Loader2,
  Medal,
  Music,
  Palette,
  Pencil,
  Plus,
  Popcorn,
  RotateCcw,
  Rocket,
  Save,
  Settings,
  Sparkles,
  Star,
  Sun,
  Target,
  Ticket,
  Timer,
  Trash2,
  Trophy,
  Tv,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DEFAULT_OCR_PROXY_URL, parseHomeworkText, recognizeHomeworkWithBaidu, testBaiduOcrConfig, type OcrDraftTask } from "./ocr";
import {
  addCloudExam,
  addCloudLedger,
  addCloudTask,
  addCloudTasks,
  addCloudTaskDeletion,
  DEFAULT_FAMILY_CODE,
  deleteCloudBadge,
  deleteCloudLedger,
  deleteCloudReward,
  deleteCloudTask,
  deleteCloudTaskDailyPlans,
  ensureCloudSeedData,
  fetchCloudData,
  fetchCloudTaskDeletionIds,
  getPointBalance,
  getBadgeRewardPoints,
  getBadgeStats,
  refreshCloudBadges,
  restoreCloudBackup,
  updateCloudSettings,
  updateCloudTask,
  deleteCloudExam,
  deleteCloudSubject,
  updateCloudExam,
  upsertCloudBadge,
  upsertCloudSubject,
  upsertCloudReward,
  upsertCloudTaskDailyPlans,
} from "./supabase";
import type { AppSettings, BackupData, Badge, ExamRecord, PointLedger, Reward, Subject, Task } from "./types";

type Tab = "dashboard" | "tasks" | "exams" | "stats" | "badges" | "rewards" | "subjects" | "settings";
type TaskSort = "default" | "time" | "subject" | "type" | "status";
type LedgerRange = "7d" | "30d" | "all" | "custom";
type ThemeId = "cloud" | "candy" | "forest" | "space" | "sunshine";
type TaskStartConflict = { runningTask: Task; nextTask: Task };
type RepeatTaskAction = { action: "edit" | "delete"; task: Task };
type OcrDraftItem = OcrDraftTask & { draftId: string };

type AppState = {
  tasks: Task[];
  exams: ExamRecord[];
  badges: Badge[];
  rewards: Reward[];
  subjects: Subject[];
  ledger: PointLedger[];
  settings?: AppSettings;
  points: number;
};

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "dashboard", label: "首页", icon: Home },
  { id: "tasks", label: "计划", icon: Timer },
  { id: "exams", label: "成绩", icon: Award },
  { id: "stats", label: "统计", icon: BarChart3 },
  { id: "badges", label: "勋章", icon: Medal },
  { id: "rewards", label: "奖励", icon: Gift },
  { id: "subjects", label: "科目", icon: BookOpen },
  { id: "settings", label: "设置", icon: Settings },
];

const palette = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#ef4444", "#0d9488"];
const assignmentTypes = ["课堂作业", "课外作业"] as const;
const defaultRepeatHorizonDays = 90;
const examTypes = ["单元测试", "随堂测试", "月考", "期中期末考试"];
const grades = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"];
const semesters = ["上学期", "下学期"];
const rewardIconOptions = [
  { name: "Gift", label: "礼物", icon: Gift },
  { name: "Tv", label: "动画", icon: Tv },
  { name: "Gamepad2", label: "游戏", icon: Gamepad2 },
  { name: "Popcorn", label: "电影", icon: Popcorn },
  { name: "Cookie", label: "饼干", icon: Cookie },
  { name: "IceCreamBowl", label: "零食", icon: IceCreamBowl },
  { name: "BookOpen", label: "阅读", icon: BookOpen },
  { name: "Palette", label: "画画", icon: Palette },
  { name: "Music", label: "音乐", icon: Music },
  { name: "Ticket", label: "门票", icon: Ticket },
  { name: "Trophy", label: "挑战", icon: Trophy },
] as const;
const badgeIconOptions = [
  { name: "Medal", label: "勋章", icon: Medal },
  { name: "Star", label: "星星", icon: Star },
  { name: "Clock", label: "时间", icon: Clock },
  { name: "Trophy", label: "奖杯", icon: Trophy },
  { name: "Target", label: "目标", icon: Target },
  { name: "CalendarCheck", label: "连续", icon: CalendarCheck },
] as const;
const badgeConditionOptions = [
  { value: "completedTasks", label: "累计完成作业" },
  { value: "studyMinutes", label: "累计学习分钟" },
  { value: "completedDays", label: "有完成记录的天数" },
  { value: "perfectDays", label: "当天作业全部完成" },
  { value: "consecutiveDays", label: "最长连续学习天数" },
  { value: "examsAbove90", label: "90 分以上考试次数" },
  { value: "examsAbove95", label: "95 分以上考试次数" },
  { value: "pointsEarned", label: "累计获得积分" },
  { value: "currentPoints", label: "当前积分达到" },
  { value: "rewardsRedeemed", label: "兑换奖励次数" },
] as const;
const badgeTemplates: Array<Omit<Badge, "id" | "unlocked">> = [
  { name: "今日小勇士", description: "第一次把当天作业全部完成", icon: "Star", conditionType: "perfectDays", conditionValue: 1 },
  { name: "连续打卡王", description: "连续 7 天都有学习完成记录", icon: "CalendarCheck", conditionType: "consecutiveDays", conditionValue: 7 },
  { name: "专注小达人", description: "累计专注学习 300 分钟", icon: "Clock", conditionType: "studyMinutes", conditionValue: 300 },
  { name: "进步之星", description: "获得 3 次 90 分以上成绩", icon: "Trophy", conditionType: "examsAbove90", conditionValue: 3 },
  { name: "积分收藏家", description: "累计获得 100 积分", icon: "Target", conditionType: "pointsEarned", conditionValue: 100 },
  { name: "愿望实现家", description: "用积分兑换 3 次喜欢的奖励", icon: "Medal", conditionType: "rewardsRedeemed", conditionValue: 3 },
];
const themeOptions: Array<{ id: ThemeId; name: string; description: string; icon: React.ElementType; colors: [string, string] }> = [
  { id: "cloud", name: "云朵蓝", description: "清爽安静，适合每天使用", icon: CloudSun, colors: ["#2563eb", "#dbeafe"] },
  { id: "candy", name: "草莓糖", description: "粉红糖果和圆点泡泡", icon: Sparkles, colors: ["#db2777", "#fce7f3"] },
  { id: "forest", name: "森林探险", description: "嫩绿叶子和自然活力", icon: Leaf, colors: ["#15803d", "#dcfce7"] },
  { id: "space", name: "星际旅行", description: "紫色星光和宇航梦想", icon: Rocket, colors: ["#7c3aed", "#ede9fe"] },
  { id: "sunshine", name: "阳光乐园", description: "明亮橙黄，元气满满", icon: Sun, colors: ["#ea580c", "#ffedd5"] },
];
const fallbackSubjects: Subject[] = [
  { id: "chinese", name: "语文", color: "#ef4444", showOnHome: true, sortOrder: 1 },
  { id: "math", name: "数学", color: "#2563eb", showOnHome: true, sortOrder: 2 },
  { id: "english", name: "英语", color: "#16a34a", showOnHome: true, sortOrder: 3 },
  { id: "science", name: "科学", color: "#9333ea", showOnHome: true, sortOrder: 4 },
  { id: "reading", name: "阅读", color: "#f59e0b", showOnHome: true, sortOrder: 5 },
  { id: "other", name: "其他", color: "#0d9488", showOnHome: false, sortOrder: 6 },
];

const today = () => toLocalDateInputValue(new Date());
const nowIso = () => new Date().toISOString();
const familyCodeKey = "homework-web-family-code";
const ocrSettingsKey = "homework-web-local-ocr";
const userRoleKey = "homework-web-user-role";
const themeKey = "homework-web-theme";

function emptyTask(startDate = today()): Omit<Task, "id" | "createdAt"> {
  return {
    category: "语文",
    assignmentType: "课堂作业",
    title: "",
    description: "",
    plannedMinutes: 30,
    actualMinutes: 0,
    status: "pending",
    repeatType: "none",
    startDate,
    autoComplete: false,
    rewardPoints: 1,
    penaltyPoints: 1,
    overduePoints: 0,
  };
}

function App() {
  const [theme, setTheme] = useState<ThemeId>(() => normalizeTheme(localStorage.getItem(themeKey)));
  const [familyCode, setFamilyCode] = useState(() => localStorage.getItem(familyCodeKey) ?? DEFAULT_FAMILY_CODE);
  const [familyCodeDraft, setFamilyCodeDraft] = useState(() => localStorage.getItem(familyCodeKey) ?? DEFAULT_FAMILY_CODE);
  const [userRole, setUserRole] = useState<"student" | "parent" | null>(() => (localStorage.getItem(userRoleKey) as "student" | "parent" | null) ?? null);
  const [parentCodeDraft, setParentCodeDraft] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [state, setState] = useState<AppState>({
    tasks: [],
    exams: [],
    badges: [],
    rewards: [],
    subjects: [],
    ledger: [],
    points: 0,
  });
  const [taskDraft, setTaskDraft] = useState(emptyTask());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const taskEditorRef = useRef<HTMLDivElement | null>(null);
  const taskTitleInputRef = useRef<HTMLInputElement | null>(null);
  const [currentDate, setCurrentDate] = useState(today());
  const [selectedTaskDate, setSelectedTaskDate] = useState(today());
  const [hideCompletedTasks, setHideCompletedTasks] = useState(false);
  const [taskSubjectFilter, setTaskSubjectFilter] = useState("全部学科");
  const [taskTypeFilter, setTaskTypeFilter] = useState("全部类别");
  const [taskStatusFilter, setTaskStatusFilter] = useState("全部状态");
  const [taskSort, setTaskSort] = useState<TaskSort>("default");
  const [examDraft, setExamDraft] = useState({
    subject: "数学",
    examType: "单元测试",
    grade: "三年级",
    semester: "下学期",
    examName: "",
    score: 95,
    totalScore: 100,
    averageScore: 85,
    classRank: 0,
    rewardPoints: 0,
    examDate: today(),
  });
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examError, setExamError] = useState("");
  const [examSubjectFilter, setExamSubjectFilter] = useState("全部学科");
  const [examTypeFilter, setExamTypeFilter] = useState("全部类别");
  const [examGradeFilter, setExamGradeFilter] = useState("全部年级");
  const [examSemesterFilter, setExamSemesterFilter] = useState("全部学期");
  const [subjectDraft, setSubjectDraft] = useState<Subject>({ id: "", name: "", color: "#2563eb", showOnHome: true, sortOrder: 10 });
  const [badgeDraft, setBadgeDraft] = useState<Badge>({ id: "", name: "", description: "", icon: "Medal", unlocked: false, conditionType: "completedTasks", conditionValue: 1 });
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [ledgerDraft, setLedgerDraft] = useState({ reason: "", points: 0 });
  const [ledgerRange, setLedgerRange] = useState<LedgerRange>("7d");
  const [ledgerDateFrom, setLedgerDateFrom] = useState(() => addLocalDays(today(), -6));
  const [ledgerDateTo, setLedgerDateTo] = useState(today());
  const [rewardDraft, setRewardDraft] = useState<Reward>({ id: "", title: "", description: "", pointsCost: 20, icon: "Gift", enabled: true });
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [statsDate, setStatsDate] = useState(today());
  const [statsRange, setStatsRange] = useState<"day" | "week" | "month">("week");
  const [ocrWarning, setOcrWarning] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrDrafts, setOcrDrafts] = useState<OcrDraftItem[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [taskStartConflict, setTaskStartConflict] = useState<TaskStartConflict | null>(null);
  const [repeatTaskAction, setRepeatTaskAction] = useState<RepeatTaskAction | null>(null);
  const [editingRepeatSeriesFrom, setEditingRepeatSeriesFrom] = useState<string | null>(null);
  const [deletedTaskIds, setDeletedTaskIds] = useState<Set<string>>(new Set());
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>({
    id: "default",
    childName: "小朋友",
    parentPassword: "admin",
    badgeStartDate: today(),
    baiduOcr: loadLocalOcrSettings(),
  });
  const [cloudStatus, setCloudStatus] = useState("正在连接 Supabase...");
  const [isCloudBusy, setIsCloudBusy] = useState(false);

  const load = async () => {
    setIsCloudBusy(true);
    try {
      await ensureCloudSeedData(familyCode);
      const data = await fetchCloudData(familyCode);
      await applyOverduePenalties(data.tasks);
      await ensureRepeatInstances(data.tasks);
      const withRepeats = await fetchCloudData(familyCode);
      const stalePausedTasks = await pauseStaleRunningTasks(withRepeats.tasks);
      const afterPause = stalePausedTasks.length > 0 ? await fetchCloudData(familyCode) : withRepeats;
      await ensureDailyTaskPlans(afterPause.tasks);
      await refreshCloudBadges(familyCode, afterPause.tasks, afterPause.badges, afterPause.exams, afterPause.ledger ?? [], afterPause.settings?.[0]?.badgeStartDate);
      const refreshed = await fetchCloudData(familyCode);
      const loadedDeletedTaskIds = await fetchCloudTaskDeletionIds(familyCode);
      const settings = refreshed.settings[0] ?? { id: "default", childName: "小朋友", badgeStartDate: today() };
      setDeletedTaskIds(loadedDeletedTaskIds);
      setState({
        tasks: refreshed.tasks,
        exams: refreshed.exams,
        badges: refreshed.badges,
        rewards: refreshed.rewards,
        subjects: refreshed.subjects ?? [],
        ledger: refreshed.ledger ?? [],
        settings,
        points: getPointBalance(refreshed.ledger ?? []),
      });
      setCloudStatus(stalePausedTasks.length > 0 ? `已自动暂停跨日作业：${stalePausedTasks.map((task) => task.title).join("、")}` : `已连接家庭同步码：${familyCode}`);
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "Supabase 连接失败");
    } finally {
      setIsCloudBusy(false);
    }
  };

  const ensureRepeatInstances = async (tasks: Task[]) => {
    const deletedTaskIds = await fetchCloudTaskDeletionIds(familyCode);
    const existingIds = new Set(tasks.map((task) => task.id));
    const creates: Task[] = tasks.flatMap((task) => {
      if (task.repeatType === "none" || isRepeatGeneratedInstanceTask(task)) return [];
      return getRepeatOccurrenceDates(task, getRepeatSeriesEndDate(task)).flatMap((date) => {
        const instanceId = getRepeatInstanceId(task, date);
        if (existingIds.has(instanceId) || deletedTaskIds.has(instanceId)) return [];
        existingIds.add(instanceId);
        return {
          ...task,
          id: instanceId,
          status: "pending" as const,
          actualMinutes: 0,
          startTime: undefined,
          endTime: undefined,
          startDate: date,
          createdAt: nowIso(),
        };
      });
    });
    await addCloudTasks(familyCode, creates);
    return creates.length;
  };

  const applyOverduePenalties = async (tasks: Task[]) => {
    const todayDate = today();
    const overdueTasks = tasks.filter((task) => task.autoComplete && task.status !== "completed" && task.status !== "expired" && getTaskDueDate(task) < todayDate);
    await Promise.all(
      overdueTasks.map(async (task) => {
        await updateCloudTask(familyCode, task.id, { status: "expired" });
        if (task.penaltyPoints > 0) await addCloudLedger(familyCode, "adjust", -task.penaltyPoints, `未按期完成作业：${task.title}`);
      }),
    );
  };

  const pauseStaleRunningTasks = async (tasks: Task[]) => {
    const todayDate = today();
    const staleTasks = tasks.filter((task) => task.status === "running" && task.startTime && getLocalDateFromIso(task.startTime) < todayDate);
    await Promise.all(
      staleTasks.map((task) => {
        const actualMinutes = (task.actualMinutes ?? 0) + getTaskRunMinutesUntilEndOfStartDay(task);
        return updateCloudTask(familyCode, task.id, { status: "paused", startTime: null, actualMinutes });
      }),
    );
    return staleTasks;
  };

  const ensureDailyTaskPlans = async (tasks: Task[]) => {
    const planDate = today();
    const plans = tasks
      .filter(
        (task) =>
          isMultiDaySingleTask(task) &&
          task.status !== "completed" &&
          task.status !== "expired" &&
          task.startDate <= planDate &&
          planDate <= (task.endDate ?? task.startDate) &&
          task.dailyPlans?.[planDate] === undefined,
      )
      .map((task) => ({
        taskId: task.id,
        planDate,
        plannedMinutes: Math.max(0, (task.plannedMinutes ?? 0) - (task.actualMinutes ?? 0)),
      }));
    await Promise.all(plans.map((plan) => deleteCloudTaskDailyPlans(familyCode, plan.taskId)));
    await upsertCloudTaskDailyPlans(familyCode, plans);
  };

  useEffect(() => {
    void load();
  }, [currentDate, familyCode]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentDate(today()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    if (editingTaskId || taskDraft.title.trim() || taskDraft.description?.trim() || taskDraft.startDate >= currentDate) return;
    setTaskDraft({
      ...taskDraft,
      startDate: currentDate,
      endDate: taskDraft.endDate && taskDraft.endDate < currentDate ? undefined : taskDraft.endDate,
    });
  }, [currentDate, editingTaskId, taskDraft.description, taskDraft.endDate, taskDraft.startDate, taskDraft.title]);

  useEffect(() => {
    if (state.settings) {
      setSettingsDraft({
        ...state.settings,
        baiduOcr: loadLocalOcrSettings(),
      });
    }
  }, [state.settings]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (state.tasks.some((task) => task.status === "running")) {
        void load();
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [state.tasks]);

  useEffect(() => {
    if (userRole !== "parent" && ["subjects", "settings"].includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [activeTab, userRole]);

  const todayTasks = state.tasks.filter((task) => taskOverlapsDate(task, today(), deletedTaskIds));
  const subjects = state.subjects.length > 0 ? state.subjects : fallbackSubjects;
  const visibleSubjects = subjects.filter((subject) => subject.showOnHome);
  const visibleTabs = tabs.filter((tab) => userRole === "parent" || !["subjects", "settings"].includes(tab.id));
  const completedToday = todayTasks.filter((task) => isTaskCompletedOnDate(task, today()));
  const studyMinutesToday = todayTasks.reduce((sum, task) => sum + getTaskMinutesForDate(task, today()), 0);
  const completionRate = todayTasks.length === 0 ? 0 : Math.round((completedToday.length / todayTasks.length) * 100);
  const filteredTasks = sortTasks(
    state.tasks.filter(
      (task) =>
        taskOverlapsDate(task, selectedTaskDate, deletedTaskIds) &&
        (!hideCompletedTasks || task.status !== "completed") &&
        (taskSubjectFilter === "全部学科" || task.category === taskSubjectFilter) &&
        (taskTypeFilter === "全部类别" || task.assignmentType === taskTypeFilter) &&
        (taskStatusFilter === "全部状态" || task.status === taskStatusFilter),
    ),
    taskSort,
    subjects,
  );
  const selectedDateCompleted = filteredTasks.filter((task) => isTaskCompletedOnDate(task, selectedTaskDate)).length;
  const filteredExams = state.exams.filter(
    (exam) =>
      (examSubjectFilter === "全部学科" || exam.subject === examSubjectFilter) &&
      (examTypeFilter === "全部类别" || exam.examType === examTypeFilter) &&
      (examGradeFilter === "全部年级" || exam.grade === examGradeFilter) &&
      (examSemesterFilter === "全部学期" || exam.semester === examSemesterFilter),
  );
  const weekDays = getWeekDays(selectedTaskDate);

  const scoreTrendPoints = useMemo(() => buildScoreTrend(state.exams, visibleSubjects), [state.exams, visibleSubjects]);
  const scoreTrendRows = useMemo(() => buildSubjectScoreTrendRows(scoreTrendPoints), [scoreTrendPoints]);
  const scoreTrendDomain = useMemo(() => getScoreTrendDomain(scoreTrendPoints), [scoreTrendPoints]);
  const latestScorePoint = scoreTrendPoints[scoreTrendPoints.length - 1];
  const previousSameSubjectScore = latestScorePoint ? [...scoreTrendPoints.slice(0, -1)].reverse().find((point) => point.subject === latestScorePoint.subject) : undefined;
  const scoreTrendDelta = latestScorePoint && previousSameSubjectScore ? latestScorePoint.score - previousSameSubjectScore.score : null;
  const badgeStats = useMemo(
    () => getBadgeStats(state.tasks, state.exams, state.ledger, state.settings?.badgeStartDate),
    [state.tasks, state.exams, state.ledger, state.settings?.badgeStartDate],
  );

  const statsWindow = useMemo(() => getStatsWindow(statsDate, statsRange), [statsDate, statsRange]);
  const statsDates = useMemo(() => getDateRange(statsWindow.start, statsWindow.end), [statsWindow]);
  const dailyTimeStats = useMemo(() => {
    const map = new Map<string, { label: string; date: string; minutes: number; planned: number; completed: number; total: number }>();
    for (const day of statsDates) {
      map.set(day, { label: day.slice(5), date: day, minutes: 0, planned: 0, completed: 0, total: 0 });
    }
    for (const task of state.tasks) {
      for (const date of statsDates) {
        if (!taskOverlapsDate(task, date, deletedTaskIds)) continue;
        const item = map.get(date);
        if (!item) continue;
        item.minutes += getTaskMinutesForDate(task, date);
        item.planned += getTaskPlannedMinutesForDate(task, date);
        item.total += getTaskTodoCountForDate(task, date);
        if (isTaskCompletedOnDate(task, date)) item.completed += 1;
      }
    }
    return [...map.values()];
  }, [state.tasks, statsDates, deletedTaskIds]);
  const subjectTimeStats = useMemo(() => {
    const map = new Map<string, { label: string; date: string; subject: string; minutes: number; planned: number; completed: number; total: number }>();
    for (const task of state.tasks) {
      if (!taskOverlapsDate(task, statsDate, deletedTaskIds)) continue;
      const item = map.get(task.category) ?? { label: task.category, date: statsDate, subject: task.category, minutes: 0, planned: 0, completed: 0, total: 0 };
      item.minutes += getTaskMinutesForDate(task, statsDate);
      item.planned += getTaskPlannedMinutesForDate(task, statsDate);
      item.total += getTaskTodoCountForDate(task, statsDate);
      if (isTaskCompletedOnDate(task, statsDate)) item.completed += 1;
      map.set(task.category, item);
    }
    return [...map.values()];
  }, [state.tasks, statsDate, deletedTaskIds]);
  const timeComparisonStats = statsRange === "day" ? subjectTimeStats : dailyTimeStats;
  const timeComparisonTitle = statsRange === "day" ? "各学科计划用时 / 实际用时" : "每日计划用时 / 实际用时";
  const completionTitle = statsRange === "day" ? "各学科完成任务" : "每日完成任务";
  const statsSummary = useMemo(
    () => dailyTimeStats.reduce((sum, item) => ({ planned: sum.planned + item.planned, minutes: sum.minutes + item.minutes, completed: sum.completed + item.completed, total: sum.total + item.total }), { planned: 0, minutes: 0, completed: 0, total: 0 }),
    [dailyTimeStats],
  );

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of state.tasks) {
      for (const date of statsDates) {
        if (!taskOverlapsDate(task, date, deletedTaskIds)) continue;
        map.set(task.category, (map.get(task.category) ?? 0) + getTaskMinutesForDate(task, date));
      }
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [state.tasks, statsDates, deletedTaskIds]);
  const studyTimeline = useMemo(() => buildStudyTimeline(state.tasks, statsDates, deletedTaskIds), [state.tasks, statsDates, deletedTaskIds]);
  const filteredLedger = useMemo(() => filterLedger(state.ledger, ledgerRange, ledgerDateFrom, ledgerDateTo), [state.ledger, ledgerRange, ledgerDateFrom, ledgerDateTo]);

  const addTask = async () => {
    if (!taskDraft.title.trim()) return;
    const currentEditingTask = editingTaskId ? state.tasks.find((item) => item.id === editingTaskId) : undefined;
    const task = normalizeTaskPoints({
      ...taskDraft,
      id: editingTaskId ?? crypto.randomUUID(),
      title: taskDraft.title.trim(),
      createdAt: editingTaskId ? currentEditingTask?.createdAt ?? nowIso() : nowIso(),
    });
    if (editingTaskId && editingRepeatSeriesFrom && currentEditingTask) {
      const tasksToUpdate = getRepeatSeriesTasks(currentEditingTask, state.tasks, editingRepeatSeriesFrom);
      await Promise.all(
        tasksToUpdate.map(async (item) => {
          await deleteCloudTaskDailyPlans(familyCode, item.id);
          return updateCloudTask(familyCode, item.id, toEditableTaskPatch(normalizeTaskPoints({
            ...item,
            category: task.category,
            assignmentType: task.assignmentType,
            title: task.title,
            description: task.description,
            plannedMinutes: task.plannedMinutes,
            repeatType: task.repeatType,
            repeatDays: task.repeatDays,
            endDate: task.endDate,
            autoComplete: task.autoComplete,
            rewardPoints: task.rewardPoints,
            penaltyPoints: task.penaltyPoints,
            overduePoints: task.overduePoints,
          })));
        }),
      );
    } else if (editingTaskId) {
      await deleteCloudTaskDailyPlans(familyCode, editingTaskId);
      await updateCloudTask(familyCode, editingTaskId, toEditableTaskPatch(task));
    } else await addCloudTasks(familyCode, buildRepeatSeriesTasks(task));
    setTaskDraft(editingTaskId ? emptyTask(currentDate) : getNextTaskDraft(taskDraft, currentDate));
    setEditingTaskId(null);
    setEditingRepeatSeriesFrom(null);
    await load();
  };

  const requestEditTask = (task: Task) => {
    if (isRepeatRelatedTask(task, state.tasks)) {
      setRepeatTaskAction({ action: "edit", task });
      return;
    }
    editTask(task);
  };

  const editRepeatTask = (task: Task, scope: "single" | "series") => {
    setRepeatTaskAction(null);
    if (scope === "series") {
      setEditingRepeatSeriesFrom(task.startDate);
      editTask(task);
      return;
    }
    setEditingRepeatSeriesFrom(null);
    editTask(task);
  };

  const enterAsStudent = () => {
    localStorage.setItem(userRoleKey, "student");
    setUserRole("student");
  };

  const enterAsParent = () => {
    const password = state.settings?.parentPassword ?? settingsDraft.parentPassword ?? "admin";
    if (parentCodeDraft.trim() !== password) {
      setCloudStatus("家长验证失败：请输入家长密码。初始密码是 admin。");
      return;
    }
    localStorage.setItem(userRoleKey, "parent");
    setUserRole("parent");
    setParentCodeDraft("");
  };

  const switchRole = () => {
    localStorage.removeItem(userRoleKey);
    setUserRole(null);
    setActiveTab("dashboard");
  };

  const requestDeleteTask = (task: Task) => {
    if (isRepeatRelatedTask(task, state.tasks)) {
      setRepeatTaskAction({ action: "delete", task });
      return;
    }
    setTaskToDelete(task);
  };

  const deleteTask = async (task: Task, scope: "single" | "series" = "single") => {
    setBusyTaskId(task.id);
    try {
      setCloudStatus(`正在删除：${task.title}`);
      const tasksToDelete = scope === "series" ? getRepeatSeriesTasks(task, state.tasks, task.startDate) : [task];
      const deletionIds = tasksToDelete.map(getRepeatDeletionIdForTask).filter((id): id is string => Boolean(id));
      if (deletionIds.length > 0) {
        await Promise.all(deletionIds.map((deletionId) => addCloudTaskDeletion(familyCode, deletionId)));
        setDeletedTaskIds((current) => new Set([...current, ...deletionIds]));
      }
      await Promise.all(
        tasksToDelete.map(async (item) => {
          await deleteCloudTaskDailyPlans(familyCode, item.id);
          await deleteCloudTask(familyCode, item.id);
        }),
      );
      setState((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => !tasksToDelete.some((deletedTask) => deletedTask.id === item.id)),
      }));
      if (editingTaskId && tasksToDelete.some((item) => item.id === editingTaskId)) cancelTaskEdit();
      if (focusTask && tasksToDelete.some((item) => item.id === focusTask.id)) setFocusTask(null);
      setTaskToDelete(null);
      setRepeatTaskAction(null);
      setCloudStatus(scope === "series" ? `已删除重复序列：${task.title}` : `已删除：${task.title}`);
      await load();
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "任务删除失败");
    } finally {
      setBusyTaskId(null);
    }
  };

  const editTask = (task: Task) => {
    setActiveTab("tasks");
    setEditingTaskId(task.id);
    setTaskDraft({
      category: task.category,
      assignmentType: task.assignmentType ?? "课外作业",
      title: task.title,
      description: task.description ?? "",
      plannedMinutes: task.plannedMinutes ?? 30,
      actualMinutes: task.actualMinutes ?? 0,
      startTime: task.startTime,
      endTime: task.endTime,
      status: task.status,
      repeatType: task.repeatType,
      repeatDays: task.repeatDays,
      startDate: task.startDate,
      endDate: task.endDate,
      autoComplete: task.autoComplete,
      rewardPoints: task.rewardPoints,
      penaltyPoints: task.penaltyPoints,
      overduePoints: task.overduePoints,
    });
    window.requestAnimationFrame(() => {
      taskEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => taskTitleInputRef.current?.focus(), 450);
    });
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setEditingRepeatSeriesFrom(null);
    setTaskDraft(emptyTask(currentDate));
  };

  const startTask = async (task: Task, options: { skipRunningCheck?: boolean } = {}) => {
    if (!options.skipRunningCheck) {
      const runningTask = state.tasks.find((item) => item.status === "running" && item.id !== task.id);
      if (runningTask) {
        setTaskStartConflict({ runningTask, nextTask: task });
        return false;
      }
    }
    setBusyTaskId(task.id);
    try {
      const startTime = nowIso();
      await updateCloudTask(familyCode, task.id, { status: "running", startTime });
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => (item.id === task.id ? { ...item, status: "running", startTime } : item)),
      }));
      setCloudStatus(`已开始：${task.title}`);
      await load();
      return true;
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "任务开始失败");
      return false;
    } finally {
      setBusyTaskId(null);
    }
  };

  const confirmStartAfterPause = async () => {
    if (!taskStartConflict) return;
    const { runningTask, nextTask } = taskStartConflict;
    setBusyTaskId(runningTask.id);
    try {
      const runningTasks = state.tasks.filter((task) => task.status === "running" && task.id !== nextTask.id);
      await Promise.all(
        runningTasks.map((task) => {
          const actualMinutes = (task.actualMinutes ?? 0) + getTaskRunMinutes(task);
          return updateCloudTask(familyCode, task.id, { status: "paused", startTime: null, actualMinutes });
        }),
      );
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => {
          const pausedTask = runningTasks.find((task) => task.id === item.id);
          if (!pausedTask) return item;
          return { ...item, status: "paused", startTime: undefined, actualMinutes: (pausedTask.actualMinutes ?? 0) + getTaskRunMinutes(pausedTask) };
        }),
      }));
      if (focusTask && runningTasks.some((task) => task.id === focusTask.id)) {
        setFocusTask({ ...focusTask, status: "paused", startTime: undefined, actualMinutes: getTaskElapsedMinutes(focusTask) });
      }
      setTaskStartConflict(null);
      await startTask(nextTask, { skipRunningCheck: true });
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "切换作业失败");
      setBusyTaskId(null);
    }
  };

  const pauseTask = async (task: Task) => {
    setBusyTaskId(task.id);
    try {
      const elapsed = getTaskRunMinutes(task);
      const actualMinutes = (task.actualMinutes ?? 0) + elapsed;
      await updateCloudTask(familyCode, task.id, { status: "paused", startTime: null, actualMinutes });
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => (item.id === task.id ? { ...item, status: "paused", startTime: undefined, actualMinutes } : item)),
      }));
      setCloudStatus(`已暂停：${task.title}`);
      await load();
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "任务暂停失败");
    } finally {
      setBusyTaskId(null);
    }
  };

  const completeTask = async (task: Task) => {
    if (task.status === "completed") return;
    setBusyTaskId(task.id);
    try {
      const actualMinutes = getTaskActualMinutesOnComplete(task);
      const points = task.autoComplete ? (isTaskOverdue(task) ? task.overduePoints : task.rewardPoints) : 0;
      await updateCloudTask(familyCode, task.id, { status: "completed", startTime: task.status === "running" && task.startTime ? task.startTime : null, endTime: nowIso(), actualMinutes });
      if (points !== 0) await addCloudLedger(familyCode, points > 0 ? "earn" : "adjust", points, `${isTaskOverdue(task) ? "逾期完成" : "按时完成"}作业：${task.title}`);
      setCloudStatus(`已完成：${task.title}${points ? `，${points > 0 ? "+" : ""}${points} 分` : ""}`);
      await load();
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "任务完成失败");
    } finally {
      setBusyTaskId(null);
    }
  };

  const addExam = async () => {
    if (!examDraft.examName.trim()) {
      setExamError("请填写考试名称。");
      return;
    }
    if (!Number.isFinite(examDraft.totalScore) || examDraft.totalScore <= 0) {
      setExamError("满分必须大于 0。");
      return;
    }
    if (!Number.isFinite(examDraft.score) || examDraft.score < 0 || examDraft.score > examDraft.totalScore) {
      setExamError("得分应在 0 到满分之间。");
      return;
    }
    if (!Number.isFinite(examDraft.averageScore) || examDraft.averageScore < 0 || examDraft.averageScore > examDraft.totalScore) {
      setExamError("平均分应在 0 到满分之间；没有数据时可填写 0。");
      return;
    }
    setExamError("");
    const exam = {
      ...examDraft,
      id: editingExamId ?? crypto.randomUUID(),
      examName: examDraft.examName.trim(),
      averageScore: examDraft.averageScore > 0 ? examDraft.averageScore : undefined,
      classRank: examDraft.classRank > 0 ? examDraft.classRank : undefined,
      rewardPoints: 0,
    };
    if (editingExamId) await updateCloudExam(familyCode, exam);
    else await addCloudExam(familyCode, exam);
    setExamDraft({ ...examDraft, examName: "" });
    setEditingExamId(null);
    await load();
  };

  const editExam = (exam: ExamRecord) => {
    setExamError("");
    setEditingExamId(exam.id);
    setExamDraft({
      subject: exam.subject,
      examType: exam.examType ?? "单元测试",
      grade: exam.grade ?? "三年级",
      semester: exam.semester ?? "下学期",
      examName: exam.examName,
      score: exam.score,
      totalScore: exam.totalScore,
      averageScore: exam.averageScore ?? 0,
      classRank: exam.classRank ?? 0,
      rewardPoints: 0,
      examDate: exam.examDate,
    });
  };

  const removeExam = async (id: string) => {
    await deleteCloudExam(familyCode, id);
    await load();
  };

  const saveSubject = async () => {
    if (!subjectDraft.name.trim()) return;
    await upsertCloudSubject(familyCode, {
      ...subjectDraft,
      id: subjectDraft.id || crypto.randomUUID(),
      name: subjectDraft.name.trim(),
      sortOrder: subjectDraft.sortOrder || subjects.length + 1,
    });
    setSubjectDraft({ id: "", name: "", color: "#2563eb", showOnHome: true, sortOrder: subjects.length + 2 });
    await load();
  };

  const removeSubject = async (subject: Subject) => {
    if (state.tasks.some((task) => task.category === subject.name) || state.exams.some((exam) => exam.subject === subject.name)) {
      setCloudStatus("这个科目已有任务或成绩，暂时不能删除。");
      return;
    }
    await deleteCloudSubject(familyCode, subject.id);
    await load();
  };

  const saveBadge = async () => {
    if (!badgeDraft.name.trim()) return;
    const badge: Badge = {
      ...badgeDraft,
      id: editingBadgeId ?? (badgeDraft.id || crypto.randomUUID()),
      name: badgeDraft.name.trim(),
      description: badgeDraft.description.trim(),
      icon: badgeDraft.icon || "Medal",
      conditionValue: Math.max(1, Number(badgeDraft.conditionValue) || 1),
      unlocked: editingBadgeId ? badgeDraft.unlocked : false,
    };
    await upsertCloudBadge(familyCode, badge);
    setBadgeDraft({ id: "", name: "", description: "", icon: "Medal", unlocked: false, conditionType: "completedTasks", conditionValue: 1 });
    setEditingBadgeId(null);
    await load();
  };

  const editBadge = (badge: Badge) => {
    setEditingBadgeId(badge.id);
    setBadgeDraft({ ...badge, icon: badge.icon || "Medal" });
  };

  const removeBadge = async (id: string) => {
    await deleteCloudBadge(familyCode, id);
    if (editingBadgeId === id) {
      setEditingBadgeId(null);
      setBadgeDraft({ id: "", name: "", description: "", icon: "Medal", unlocked: false, conditionType: "completedTasks", conditionValue: 1 });
    }
    await load();
  };

  const redeemReward = async (reward: Reward) => {
    if (state.points < reward.pointsCost) return;
    await addCloudLedger(familyCode, "spend", -reward.pointsCost, `兑换奖励：${reward.title}`);
    await load();
  };

  const saveManualLedger = async () => {
    if (!ledgerDraft.reason.trim() || ledgerDraft.points === 0) return;
    const points = Number(ledgerDraft.points);
    await addCloudLedger(familyCode, points > 0 ? "earn" : "adjust", points, ledgerDraft.reason.trim());
    setLedgerDraft({ reason: "", points: 0 });
    await load();
  };

  const removeLedger = async (id: string) => {
    await deleteCloudLedger(familyCode, id);
    await load();
  };

  const saveReward = async () => {
    if (!rewardDraft.title.trim()) return;
    const reward: Reward = {
      ...rewardDraft,
      id: editingRewardId ?? (rewardDraft.id || crypto.randomUUID()),
      title: rewardDraft.title.trim(),
      description: rewardDraft.description?.trim(),
      pointsCost: Math.max(0, Number(rewardDraft.pointsCost) || 0),
      icon: rewardDraft.icon || "Gift",
      enabled: rewardDraft.enabled,
    };
    await upsertCloudReward(familyCode, reward);
    setRewardDraft({ id: "", title: "", description: "", pointsCost: 20, icon: "Gift", enabled: true });
    setEditingRewardId(null);
    await load();
  };

  const editReward = (reward: Reward) => {
    setEditingRewardId(reward.id);
    setRewardDraft({ ...reward, icon: reward.icon || "Gift" });
  };

  const removeReward = async (id: string) => {
    await deleteCloudReward(familyCode, id);
    if (editingRewardId === id) {
      setEditingRewardId(null);
      setRewardDraft({ id: "", title: "", description: "", pointsCost: 20, icon: "Gift", enabled: true });
    }
    await load();
  };

  const downloadBackup = async () => {
    const backup: BackupData = {
      tasks: state.tasks,
      exams: state.exams,
      badges: state.badges,
      rewards: state.rewards,
      subjects: state.subjects,
      settings: state.settings ? [{ id: state.settings.id, childName: state.settings.childName, parentPassword: state.settings.parentPassword ?? "admin", badgeStartDate: state.settings.badgeStartDate ?? today() }] : [],
      ledger: state.ledger,
      exportedAt: nowIso(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `homework-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File, mode: "overwrite" | "merge") => {
    const text = await file.text();
    await restoreCloudBackup(familyCode, JSON.parse(text), mode);
    await load();
  };

  const saveSettings = async () => {
    const nextSettings = { ...settingsDraft, baiduOcr: normalizeOcrSettings(settingsDraft.baiduOcr) };
    await updateCloudSettings(familyCode, nextSettings);
    localStorage.setItem(ocrSettingsKey, JSON.stringify(nextSettings.baiduOcr));
    setSettingsDraft(nextSettings);
    setOcrWarning("设置已保存到 Supabase。OCR 现在使用云端代理，不会从浏览器直连百度。");
    await load();
  };

  const testOcrSettings = async () => {
    const config = normalizeOcrSettings(settingsDraft.baiduOcr ?? loadLocalOcrSettings());
    if (!config) return;
    setOcrWarning("正在测试百度云 OCR 配置...");
    try {
      const result = await testBaiduOcrConfig(
        config.mode === "local"
          ? { mode: "local", apiKey: config.apiKey ?? "", secretKey: config.secretKey ?? "" }
          : { mode: "proxy", proxyUrl: config.proxyUrl ?? DEFAULT_OCR_PROXY_URL },
      );
      setOcrWarning(result);
    } catch (error) {
      setOcrWarning(
        error instanceof TypeError
          ? "浏览器直连百度 OCR 被拦截或网络不可达。若保存的密钥正确，可能需要使用代理接口模式。"
          : error instanceof Error
            ? error.message
            : "OCR 配置测试失败",
      );
    }
  };

  const saveFamilyCode = async () => {
    const nextCode = familyCodeDraft.trim();
    if (!nextCode) return;
    localStorage.setItem(familyCodeKey, nextCode);
    setFamilyCode(nextCode);
  };

  const recognizeImage = async (file: File) => {
    const config = normalizeOcrSettings(settingsDraft.baiduOcr ?? loadLocalOcrSettings());
    if (!config) {
      setOcrStatus("请先到设置页保存百度云 OCR 配置。");
      return;
    }
    if (config.mode === "local" && (!config.apiKey || !config.secretKey)) {
      setOcrStatus("请先填写 API Key 和 Secret Key。");
      return;
    }
    if (config.mode === "proxy" && !config.proxyUrl) {
      setOcrStatus("请先填写 OCR 代理接口 URL。");
      return;
    }
    const ocrConfig =
      config.mode === "local"
        ? { mode: "local" as const, apiKey: config.apiKey ?? "", secretKey: config.secretKey ?? "" }
        : { mode: "proxy" as const, proxyUrl: config.proxyUrl ?? DEFAULT_OCR_PROXY_URL };

    setIsRecognizing(true);
    setOcrStatus("正在识别图片...");
    try {
      const drafts = withOcrDraftIds(await recognizeHomeworkWithBaidu(file, ocrConfig));
      setOcrDrafts(drafts);
      setOcrStatus(drafts.length > 0 ? `识别到 ${drafts.length} 条内容，请确认后添加。` : "没有识别到可用文字。");
    } catch (error) {
      setOcrStatus(error instanceof Error ? error.message : "OCR 识别失败");
    } finally {
      setIsRecognizing(false);
    }
  };

  const parseManualText = () => {
    const drafts = withOcrDraftIds(parseHomeworkText(ocrText));
    setOcrDrafts(drafts);
    setOcrStatus(drafts.length > 0 ? `拆解出 ${drafts.length} 条任务，请确认后添加。` : "没有拆解出可用任务。");
  };

  const addOcrDraft = async (draft: OcrDraftItem) => {
    await addCloudTask(familyCode, {
      ...emptyTask(),
      id: crypto.randomUUID(),
      category: draft.category,
      assignmentType: draft.assignmentType ?? "课堂作业",
      title: draft.title,
      description: draft.description,
      plannedMinutes: draft.plannedMinutes ?? 25,
      rewardPoints: 1,
      createdAt: nowIso(),
    });
    setOcrDrafts((items) => items.filter((item) => item !== draft));
    await load();
  };

  const updateOcrDraft = (draftId: string, changes: Partial<OcrDraftTask>) => {
    setOcrDrafts((items) => items.map((item) => (item.draftId === draftId ? { ...item, ...changes } : item)));
  };

  if (!userRole) {
    return (
      <main className="app-shell grid min-h-screen place-items-center p-4 text-slate-900" data-theme={theme}>
        <section className="app-surface w-full max-w-xl rounded-[30px] p-6 shadow-soft">
          <h1 className="text-3xl font-black">成长星球</h1>
          <p className="mt-2 text-slate-600">请选择登录身份。学生可直接进入，家长用密码验证后管理科目和设置。</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button className="primary-button" onClick={enterAsStudent}>
              学生进入
            </button>
            <div className="grid gap-3">
              <input className="input" placeholder="家长密码，初始 admin" type="password" value={parentCodeDraft} onChange={(event) => setParentCodeDraft(event.target.value)} />
              <button className="secondary-button" onClick={enterAsParent}>
                家长验证
              </button>
            </div>
          </div>
          {cloudStatus && <p className="mt-4 rounded-2xl bg-slate-50 p-4 font-bold text-slate-600">{cloudStatus}</p>}
          <div className="mt-5 border-t-2 border-slate-100 pt-4">
            <ThemePicker value={theme} onChange={setTheme} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen text-slate-900" data-theme={theme}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-4 xl:flex-row xl:px-6">
        <aside className="app-sidebar rounded-[28px] p-3 shadow-soft xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:w-56">
          <div className="mb-4 flex items-center gap-3 px-3 py-2">
            <div className="theme-logo grid size-12 place-items-center rounded-2xl text-white">
              <Sparkles />
            </div>
            <div>
              <p className="text-sm text-slate-500">学习打卡</p>
              <h1 className="text-xl font-black">成长星球</h1>
            </div>
          </div>
          <nav className="grid grid-cols-4 gap-2 xl:grid-cols-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.id}
                  className={`nav-button ${activeTab === tab.id ? "nav-button-active" : ""}`}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    setActiveTab(tab.id);
                  }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={22} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-3 border-t-2 border-slate-100 pt-3">
            <ThemePicker compact value={theme} onChange={setTheme} />
          </div>
          <button className="theme-secondary-surface mt-3 w-full rounded-2xl px-3 py-2 text-sm font-black text-slate-600" onClick={switchRole}>
            {userRole === "parent" ? "家长" : "学生"} · 切换身份
          </button>
        </aside>

        <section className="flex-1 pb-10">
          {activeTab === "dashboard" && (
            <div className="space-y-5">
              <Header title={`${state.settings?.childName ?? "小朋友"}，今天也很棒`} subtitle="完成一个小目标，就离好习惯近一点。" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric title="今日学习" value={`${studyMinutesToday}`} suffix="分钟" tone="blue" />
                <Metric title="今日任务" value={`${completedToday.length}/${todayTasks.length}`} suffix="个" tone="green" />
                <Metric title="完成率" value={`${completionRate}`} suffix="%" tone="yellow" />
                <Metric title="当前积分" value={`${state.points}`} suffix="分" tone="purple" />
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                <Panel title="最近成绩趋势">
                  {scoreTrendPoints.length > 0 ? (
                    <>
                      <div className="score-trend-summary">
                        <div>
                          <span>最近一次</span>
                          <strong>{latestScorePoint.score}<small>分</small></strong>
                          <em>{latestScorePoint.subject} · {latestScorePoint.examName}</em>
                        </div>
                        <div className={`score-trend-delta ${scoreTrendDelta !== null && scoreTrendDelta > 0 ? "score-trend-up" : scoreTrendDelta !== null && scoreTrendDelta < 0 ? "score-trend-down" : ""}`}>
                          {scoreTrendDelta === null ? `${latestScorePoint.subject}的第一条趋势` : scoreTrendDelta === 0 ? "与同科上次持平" : `比同科上次 ${scoreTrendDelta > 0 ? "+" : ""}${scoreTrendDelta} 分`}
                        </div>
                      </div>
                      <ChartBox className="score-trend-chart">
                        <ResponsiveContainer minWidth={0} initialDimension={{ width: 800, height: 240 }}>
                          <LineChart data={scoreTrendRows} margin={{ top: 18, right: 18, bottom: 4, left: 8 }}>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe3f0" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={44} tickMargin={8} />
                            <YAxis domain={scoreTrendDomain} ticks={getScoreTrendTicks(scoreTrendDomain)} tickLine={false} axisLine={false} width={46} tickMargin={6} />
                            <ReferenceLine y={80} stroke="#94a3b8" strokeDasharray="5 5" />
                            <Tooltip
                              formatter={(value, name) => [`${value} 分`, name]}
                              labelFormatter={(label) => `${label}`}
                            />
                            {visibleSubjects.filter((subject) => scoreTrendPoints.some((point) => point.subject === subject.name)).map((subject) => (
                              <Line
                                key={subject.id}
                                dataKey={subject.name}
                                name={subject.name}
                                stroke={subject.color}
                                strokeWidth={4}
                                type="monotone"
                                connectNulls
                                dot={{ r: 5, fill: "white", stroke: subject.color, strokeWidth: 3 }}
                                activeDot={{ r: 7, fill: "white", stroke: subject.color, strokeWidth: 4 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartBox>
                      <div className="score-subject-legend" aria-label="成绩科目颜色">
                        {visibleSubjects.filter((subject) => scoreTrendPoints.some((item) => item.subject === subject.name)).map((subject) => (
                          <span key={subject.id}><i style={{ backgroundColor: subject.color }} />{subject.name}</span>
                        ))}
                      </div>
                    </>
                  ) : <EmptyText text="还没有可显示的成绩，记录第一场考试后就能看到趋势。" />}
                </Panel>
                <Panel title="最近勋章">
                  <div className="grid gap-3">
                    {state.badges.filter((badge) => badge.unlocked).slice(0, 4).map((badge) => (
                      <div className="flex items-center gap-3 rounded-2xl bg-yellow-50 p-3" key={badge.id}>
                        <Medal className="text-yellow-600" />
                        <div>
                          <p className="font-bold">{badge.name}</p>
                          <p className="text-sm text-slate-500">{badge.description}</p>
                        </div>
                      </div>
                    ))}
                    {state.badges.every((badge) => !badge.unlocked) && <EmptyText text="完成第一个任务就会点亮勋章。" />}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="space-y-5">
              <Header title="学习计划" subtitle="少输入，多点击，任务完成马上得积分。" />
              <div className={`task-editor-target ${editingTaskId ? "task-editor-active" : ""}`} ref={taskEditorRef}>
              <Panel title={editingTaskId ? "修改作业" : "添加任务"}>
                {editingTaskId && (
                  <div className="task-edit-notice">
                    <Pencil size={20} />
                    <div>
                      <strong>正在修改：{taskDraft.title}</strong>
                      <span>调整完成后，请点击下方“保存设置”。</span>
                    </div>
                  </div>
                )}
                <div className="grid gap-3 lg:grid-cols-[140px_140px_1fr_120px_140px]">
                  <select className="input" value={taskDraft.category} onChange={(event) => setTaskDraft({ ...taskDraft, category: event.target.value })}>
                    {subjects.map((subject) => (
                      <option key={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                  <select className="input" value={taskDraft.assignmentType ?? "课外作业"} onChange={(event) => setTaskDraft({ ...taskDraft, assignmentType: event.target.value as Task["assignmentType"] })}>
                    {assignmentTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <input ref={taskTitleInputRef} className="input" placeholder="例如：数学口算 20 题" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} />
                  <NumberInput value={taskDraft.plannedMinutes ?? 0} suffix="分钟" onChange={(value) => setTaskDraft({ ...taskDraft, plannedMinutes: value })} />
                  <select
                    className="input"
                    value={taskDraft.repeatType}
                    onChange={(event) => setTaskDraft({ ...taskDraft, repeatType: event.target.value as Task["repeatType"], repeatDays: [] })}
                  >
                    <option value="none">不重复</option>
                    <option value="daily">每天</option>
                    <option value="weekly">每周</option>
                  </select>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="input flex items-center gap-3">
                    <span className="shrink-0 text-sm text-slate-500">开始日期</span>
                    <input className="w-full bg-transparent outline-none" type="date" value={taskDraft.startDate} onChange={(event) => setTaskDraft({ ...taskDraft, startDate: event.target.value })} />
                  </label>
                  <label className="input flex items-center gap-3">
                    <span className="shrink-0 text-sm text-slate-500">周期结束/完成日期</span>
                    <input className="w-full bg-transparent outline-none" type="date" value={taskDraft.endDate ?? ""} onChange={(event) => setTaskDraft({ ...taskDraft, endDate: event.target.value || undefined })} />
                  </label>
                </div>
                <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                  <button className={`reward-toggle ${taskDraft.autoComplete ? "reward-toggle-on" : ""}`} onClick={() => setTaskDraft(toggleTaskPoints(taskDraft))}>
                    <span>
                      <GraduationCap size={18} />
                    </span>
                    <strong>{taskDraft.autoComplete ? "积分奖惩已打开" : "打开积分奖惩"}</strong>
                  </button>
                  {taskDraft.autoComplete && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <NumberInput value={taskDraft.rewardPoints} suffix="按时奖励" onChange={(value) => setTaskDraft({ ...taskDraft, rewardPoints: value })} />
                      <NumberInput value={taskDraft.overduePoints} suffix="逾期完成" onChange={(value) => setTaskDraft({ ...taskDraft, overduePoints: value })} />
                      <NumberInput value={taskDraft.penaltyPoints} suffix="未完成扣分" onChange={(value) => setTaskDraft({ ...taskDraft, penaltyPoints: value })} />
                    </div>
                  )}
                </div>
                {taskDraft.repeatType === "weekly" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["一", "二", "三", "四", "五", "六", "日"].map((day, index) => {
                      const selected = taskDraft.repeatDays?.includes(index);
                      return (
                        <button
                          className={selected ? "primary-button" : "secondary-button"}
                          key={day}
                          onClick={() => {
                            const days = new Set(taskDraft.repeatDays ?? []);
                            if (selected) days.delete(index);
                            else days.add(index);
                            setTaskDraft({ ...taskDraft, repeatDays: [...days].sort() });
                          }}
                        >
                          周{day}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-3">
                  <button className="primary-button" onClick={addTask}>
                    {editingTaskId ? <Save size={20} /> : <Plus size={20} />} {editingTaskId ? "保存设置" : "添加"}
                  </button>
                  {editingTaskId && (
                    <button className="secondary-button" onClick={cancelTaskEdit}>
                      取消
                    </button>
                  )}
                </div>
              </Panel>
              </div>
              <Panel title="OCR 识别作业">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="secondary-button cursor-pointer">
                      {isRecognizing ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />} 上传作业图片
                      <input className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && void recognizeImage(event.target.files[0])} />
                    </label>
                    {ocrStatus && <span className="font-bold text-slate-600">{ocrStatus}</span>}
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
                    <textarea
                      className="input min-h-28 py-3"
                      placeholder="也可以把老师发的作业文字粘贴到这里，一键拆成任务"
                      value={ocrText}
                      onChange={(event) => setOcrText(event.target.value)}
                    />
                    <button className="primary-button self-start" onClick={parseManualText}>
                      <Sparkles size={20} /> 智能拆解
                    </button>
                  </div>
                  {ocrDrafts.length > 0 && (
                    <div className="grid gap-3">
                      {ocrDrafts.map((draft, index) => (
                        <div className="ocr-row" key={draft.draftId}>
                          <div className="grid flex-1 gap-2 md:grid-cols-[120px_120px_1fr_110px]">
                            <select className="input" value={draft.category} onChange={(event) => updateOcrDraft(draft.draftId, { category: event.target.value })}>
                              {subjects.map((subject) => (
                                <option key={subject.id}>{subject.name}</option>
                              ))}
                            </select>
                            <select className="input" value={draft.assignmentType ?? "课堂作业"} onChange={(event) => updateOcrDraft(draft.draftId, { assignmentType: event.target.value as Task["assignmentType"] })}>
                              {assignmentTypes.map((type) => (
                                <option key={type}>{type}</option>
                              ))}
                            </select>
                            <input className="input" value={draft.title} onChange={(event) => updateOcrDraft(draft.draftId, { title: event.target.value })} />
                            <NumberInput value={draft.plannedMinutes ?? 25} suffix="分钟" onChange={(value) => updateOcrDraft(draft.draftId, { plannedMinutes: value })} />
                          </div>
                          <button className="primary-button" onClick={() => addOcrDraft(draft)}>
                            <Plus size={20} /> 添加
                          </button>
                          <button className="danger-button" onClick={() => setOcrDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index))}>
                            <Trash2 size={20} /> 删除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
              <Panel title="历史作业查询">
                <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                  <label className="input flex items-center gap-3">
                    <span className="shrink-0 text-sm text-slate-500">查询日期</span>
                    <input className="w-full bg-transparent outline-none" type="date" value={selectedTaskDate} onChange={(event) => setSelectedTaskDate(event.target.value)} />
                  </label>
                  <button className="secondary-button" onClick={() => setSelectedTaskDate(today())}>
                    今天
                  </button>
                  <button className={hideCompletedTasks ? "primary-button" : "secondary-button"} onClick={() => setHideCompletedTasks((value) => !value)}>
                    {hideCompletedTasks ? "显示已完成" : "隐藏已完成"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {weekDays.map((day) => (
                    <button className={day.date === selectedTaskDate ? "primary-button" : "secondary-button"} key={day.date} onClick={() => setSelectedTaskDate(day.date)}>
                      {day.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <select className="input" value={taskSubjectFilter} onChange={(event) => setTaskSubjectFilter(event.target.value)}>
                    <option>全部学科</option>
                    {subjects.map((subject) => (
                      <option key={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                  <select className="input" value={taskTypeFilter} onChange={(event) => setTaskTypeFilter(event.target.value)}>
                    <option>全部类别</option>
                    {assignmentTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <select className="input" value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)}>
                    <option>全部状态</option>
                    <option value="pending">未开始</option>
                    <option value="running">进行中</option>
                    <option value="paused">已暂停</option>
                    <option value="completed">已完成</option>
                    <option value="expired">已过期</option>
                  </select>
                  <select className="input" value={taskSort} onChange={(event) => setTaskSort(event.target.value as TaskSort)}>
                    <option value="default">默认：未完成优先</option>
                    <option value="time">按开始时间</option>
                    <option value="subject">按学科</option>
                    <option value="type">按作业类别</option>
                    <option value="status">按完成状态</option>
                  </select>
                </div>
                <p className="mt-3 rounded-2xl bg-slate-50 p-4 font-bold text-slate-600">
                  {selectedTaskDate} 有 {filteredTasks.length} 个作业，已完成 {selectedDateCompleted} 个。跨日作业会显示在开始日期到完成日期之间的每一天。
                </p>
              </Panel>
              <div className="grid gap-4">
                {filteredTasks.map((task) => (
                  <article className={`task-card ${task.status === "completed" ? "task-done" : ""}`} key={task.id}>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="pill" style={{ backgroundColor: `${getSubjectColor(subjects, task.category)}22`, color: getSubjectColor(subjects, task.category) }}>
                          {task.category}
                        </span>
                        <span className={`pill ${getTaskStatusClass(task.status)}`}>
                          {getTaskStatusLabel(task.status)}
                        </span>
                        <span className="pill status-pending">{task.assignmentType ?? "课外作业"}</span>
                        {isRepeatRelatedTask(task, state.tasks) && <span className="pill status-running">重复 · {getRepeatCycleLabel(task, state.tasks)}</span>}
                      </div>
                      <h3 className="mt-3 text-2xl font-black">{task.title}</h3>
                      <p className="mt-2 text-slate-600">
                        计划 {getTaskPlannedMinutesForDate(task, selectedTaskDate)} 分钟 · 已学 {getTaskElapsedMinutes(task)} 分钟
                        {task.autoComplete ? ` · 按时 ${task.rewardPoints} 分 · 逾期 ${task.overduePoints} 分 · 未完成 -${task.penaltyPoints} 分` : ""}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        开始日期 {task.startDate}
                        {task.startTime ? ` · 开始 ${formatDateTime(task.startTime)}` : ""}
                        {task.status === "completed" && task.endTime ? ` · 完成 ${formatDateTime(task.endTime)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.status !== "completed" && (
                        <>
                          <button className={task.status === "running" ? "primary-button" : "secondary-button"} disabled={busyTaskId === task.id || task.status === "running"} onClick={() => startTask(task)}>
                            {busyTaskId === task.id ? <Loader2 className="animate-spin" size={20} /> : <Clock size={20} />}
                            {task.status === "paused" ? "继续" : task.status === "running" ? "已开始" : "开始"}
                          </button>
                          {task.status === "running" && (
                            <button className="secondary-button" disabled={busyTaskId === task.id} onClick={() => pauseTask(task)}>
                              {busyTaskId === task.id ? <Loader2 className="animate-spin" size={20} /> : <Clock size={20} />} 暂停
                            </button>
                          )}
                          <button className="secondary-button" onClick={() => setFocusTask(task)}>
                            <Target size={20} /> 专注
                          </button>
                          <button className="success-button" disabled={busyTaskId === task.id} onClick={() => completeTask(task)}>
                            {busyTaskId === task.id ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} 完成
                          </button>
                        </>
                      )}
                      <button className="secondary-button task-edit-button" onClick={() => requestEditTask(task)}>
                        <Pencil size={18} /> 修改
                      </button>
                      <span className="task-delete-zone">
                        <button className="icon-button task-delete-button" disabled={busyTaskId === task.id} onClick={() => requestDeleteTask(task)} aria-label="删除任务" title="删除任务">
                          {busyTaskId === task.id ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                        </button>
                      </span>
                    </div>
                  </article>
                ))}
                {filteredTasks.length === 0 && <EmptyText text="这一天没有需要显示的作业。" />}
              </div>
            </div>
          )}

          {activeTab === "exams" && (
            <div className="space-y-5">
              <Header title="成绩记录" subtitle="记录考试，也看见一点点进步。" />
              <Panel title="添加成绩">
                <div className="exam-form-main">
                  <select className="input" value={examDraft.subject} onChange={(event) => setExamDraft({ ...examDraft, subject: event.target.value })}>
                    {subjects.map((subject) => (
                      <option key={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                  <select className="input" value={examDraft.examType} onChange={(event) => setExamDraft({ ...examDraft, examType: event.target.value })}>
                    {examTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <select className="input" value={examDraft.grade} onChange={(event) => setExamDraft({ ...examDraft, grade: event.target.value })}>
                    {grades.map((grade) => (
                      <option key={grade}>{grade}</option>
                    ))}
                  </select>
                  <select className="input" value={examDraft.semester} onChange={(event) => setExamDraft({ ...examDraft, semester: event.target.value })}>
                    {semesters.map((semester) => (
                      <option key={semester}>{semester}</option>
                    ))}
                  </select>
                  <input className="input" placeholder="考试名称" value={examDraft.examName} onChange={(event) => setExamDraft({ ...examDraft, examName: event.target.value })} />
                </div>
                <div className="exam-form-details">
                  <NumberInput className="exam-field-small" value={examDraft.score} suffix="得分" onChange={(value) => setExamDraft({ ...examDraft, score: value })} />
                  <NumberInput className="exam-field-small" value={examDraft.totalScore} suffix="满分" onChange={(value) => setExamDraft({ ...examDraft, totalScore: value })} />
                  <NumberInput className="exam-field-medium" value={examDraft.averageScore} suffix="平均分" onChange={(value) => setExamDraft({ ...examDraft, averageScore: value })} />
                  <NumberInput className="exam-field-medium" value={examDraft.classRank} suffix="班级名次" onChange={(value) => setExamDraft({ ...examDraft, classRank: value })} />
                  <input className="input exam-date-input" type="date" value={examDraft.examDate} onChange={(event) => setExamDraft({ ...examDraft, examDate: event.target.value })} />
                  <button className="primary-button exam-save-button" onClick={addExam}>
                    <Save size={20} /> {editingExamId ? "更新" : "保存"}
                  </button>
                </div>
                {examError && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-600" role="alert">{examError}</p>}
              </Panel>
              <Panel title="成绩筛选">
                <div className="grid gap-3 md:grid-cols-4">
                  <select className="input" value={examSubjectFilter} onChange={(event) => setExamSubjectFilter(event.target.value)}>
                    <option>全部学科</option>
                    {subjects.map((subject) => (
                      <option key={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                  <select className="input" value={examGradeFilter} onChange={(event) => setExamGradeFilter(event.target.value)}>
                    <option>全部年级</option>
                    {grades.map((grade) => (
                      <option key={grade}>{grade}</option>
                    ))}
                  </select>
                  <select className="input" value={examSemesterFilter} onChange={(event) => setExamSemesterFilter(event.target.value)}>
                    <option>全部学期</option>
                    {semesters.map((semester) => (
                      <option key={semester}>{semester}</option>
                    ))}
                  </select>
                  <select className="input" value={examTypeFilter} onChange={(event) => setExamTypeFilter(event.target.value)}>
                    <option>全部类别</option>
                    {examTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </Panel>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredExams.map((exam) => (
                  <article className="exam-card" key={exam.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="pill" style={{ backgroundColor: `${getSubjectColor(subjects, exam.subject)}22`, color: getSubjectColor(subjects, exam.subject) }}>
                          {exam.subject}
                        </span>
                        <h3 className="mt-2 truncate text-lg font-black">{exam.examName}</h3>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="mini-tag">{exam.grade}</span>
                          <span className="mini-tag mini-tag-green">{exam.semester}</span>
                          <span className="mini-tag mini-tag-blue">{exam.examType}</span>
                        </div>
                      </div>
                      <div className="score-ring" style={{ "--score": `${formatPercent(exam.score, exam.totalScore)}%` } as React.CSSProperties}>
                        <span>{exam.score}<small>/{exam.totalScore}</small></span>
                      </div>
                    </div>
                    <div className="exam-card-footer">
                      <div className="exam-card-meta">
                        <span>{exam.examDate}</span>
                        {exam.classRank ? <span>班级第 {exam.classRank} 名</span> : null}
                      </div>
                      <div className="flex gap-2">
                        <button className="icon-button" onClick={() => editExam(exam)} aria-label="修改成绩">
                          <Pencil size={18} />
                        </button>
                        <button className="icon-button" onClick={() => removeExam(exam.id)} aria-label="删除成绩">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="space-y-5">
              <Header title="学习统计" subtitle="用图表看见时间、完成率和科目分布。" />
              <Panel title="统计范围">
                <div className="stats-controls">
                  <input className="input" type="date" value={statsDate} onChange={(event) => setStatsDate(event.target.value)} />
                  <div className="segmented-control">
                    {[
                      ["day", "当天"],
                      ["week", "本周"],
                      ["month", "本月"],
                    ].map(([value, label]) => (
                      <button className={statsRange === value ? "primary-button" : "secondary-button"} key={value} onClick={() => setStatsRange(value as typeof statsRange)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <Metric title="计划用时" value={`${statsSummary.planned}`} suffix="分钟" tone="blue" />
                  <Metric title="实际用时" value={`${statsSummary.minutes}`} suffix="分钟" tone="green" />
                  <Metric title="完成任务" value={`${statsSummary.completed}`} suffix={`/ ${statsSummary.total} 个`} tone="yellow" />
                  <Metric title="完成率" value={`${statsSummary.total ? Math.round((statsSummary.completed / statsSummary.total) * 100) : 0}`} suffix="%" tone="purple" />
                </div>
              </Panel>
              <Panel title="每日作业时间轴">
                <StudyTimeline days={studyTimeline} subjects={subjects} />
              </Panel>
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title={timeComparisonTitle}>
                  <ChartBox>
                    <ResponsiveContainer minWidth={0} initialDimension={{ width: 800, height: 288 }}>
                      <BarChart data={timeComparisonStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="planned" fill="#60a5fa" name="计划用时" radius={[10, 10, 0, 0]} />
                        <Bar dataKey="minutes" fill="#f59e0b" name="实际用时" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartBox>
                </Panel>
                <Panel title={completionTitle}>
                  <ChartBox>
                    <ResponsiveContainer minWidth={0} initialDimension={{ width: 800, height: 288 }}>
                      <BarChart data={timeComparisonStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="completed" fill="#14b8a6" name="已完成" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartBox>
                </Panel>
                <Panel title="分类时间占比">
                  <ChartBox>
                    <ResponsiveContainer minWidth={0} initialDimension={{ width: 800, height: 288 }}>
                      <PieChart>
                        <Pie data={categoryStats} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={4}>
                          {categoryStats.map((entry, index) => (
                            <Cell key={entry.name} fill={getSubjectColor(subjects, entry.name) ?? palette[index % palette.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartBox>
                </Panel>
              </div>
            </div>
          )}

          {activeTab === "badges" && (
            <div className="space-y-5">
              <Header title="成就星图" subtitle="看得见进度、拿得到积分，每个小进步都有回应。" />
              {userRole === "parent" && (
                <Panel title={editingBadgeId ? "修改勋章规则" : "添加勋章规则"}>
                  {!editingBadgeId && (
                    <div className="achievement-templates">
                      <div className="achievement-guide">
                        <Sparkles size={22} />
                        <div><strong>成就会自动奖励积分</strong><span>奖励分值会根据目标难度自动计算，解锁只发放一次。</span></div>
                      </div>
                      <p>从模板开始</p>
                      <div className="achievement-template-grid">
                        {badgeTemplates.map((template) => {
                          const TemplateIcon = getBadgeIcon(template.icon);
                          return (
                            <button
                              type="button"
                              key={template.name}
                              onClick={() => setBadgeDraft({ ...template, id: "", unlocked: false })}
                            >
                              <TemplateIcon size={20} />
                              <span><strong>{template.name}</strong><small>{getBadgeConditionLabel(template.conditionType)} · {template.conditionValue}</small></span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="badge-form">
                    <input className="input" placeholder="勋章名称" value={badgeDraft.name} onChange={(event) => setBadgeDraft({ ...badgeDraft, name: event.target.value })} />
                    <select className="input" value={badgeDraft.conditionType} onChange={(event) => setBadgeDraft({ ...badgeDraft, conditionType: event.target.value })}>
                      {badgeConditionOptions.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                    <NumberInput value={badgeDraft.conditionValue} suffix="目标" onChange={(value) => setBadgeDraft({ ...badgeDraft, conditionValue: value })} />
                    <button className="primary-button" onClick={saveBadge}>
                      <Save size={20} /> {editingBadgeId ? "更新" : "添加"}
                    </button>
                  </div>
                  <div className="achievement-reward-preview">
                    <Star size={18} /> 达成后自动获得 <strong>+{getBadgeRewardPoints(badgeDraft)} 积分</strong>
                  </div>
                  <textarea
                    className="input mt-3 min-h-24 w-full py-3"
                    placeholder="勋章说明，例如：连续一周认真完成学习计划"
                    value={badgeDraft.description}
                    onChange={(event) => setBadgeDraft({ ...badgeDraft, description: event.target.value })}
                  />
                  <div className="icon-picker">
                    {badgeIconOptions.map((item) => {
                      const Icon = item.icon;
                      const selected = (badgeDraft.icon ?? "Medal") === item.name;
                      return (
                        <button className={selected ? "icon-choice icon-choice-active" : "icon-choice"} key={item.name} onClick={() => setBadgeDraft({ ...badgeDraft, icon: item.name })} title={item.label}>
                          <Icon size={20} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Panel>
              )}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {state.badges.map((badge) => {
                  const BadgeIcon = getBadgeIcon(badge.icon);
                  const current = badgeStats[badge.conditionType] ?? 0;
                  const progress = badge.unlocked ? 100 : Math.min(100, Math.round((current / Math.max(1, badge.conditionValue)) * 100));
                  return (
                    <article className={`badge-card ${badge.unlocked ? "badge-unlocked" : ""}`} key={badge.id}>
                      <div className="achievement-card-heading">
                        <span><BadgeIcon size={34} /></span>
                        <em>{badge.unlocked ? "已达成" : `+${getBadgeRewardPoints(badge)} 积分`}</em>
                      </div>
                      <h3>{badge.name}</h3>
                      <p>{badge.description}</p>
                      <div className="achievement-progress-label">
                        <strong>{badge.unlocked ? "已解锁" : getBadgeConditionLabel(badge.conditionType)}</strong>
                        <span>{badge.unlocked ? "目标达成" : `${Math.min(current, badge.conditionValue)} / ${badge.conditionValue}`}</span>
                      </div>
                      <div className="achievement-progress" role="progressbar" aria-label={`${badge.name}进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                        <i style={{ width: `${progress}%` }} />
                      </div>
                      {userRole === "parent" && (
                        <div className="mt-3 flex gap-2">
                          <button className="secondary-button flex-1" onClick={() => editBadge(badge)}>
                            <Pencil size={18} /> 修改
                          </button>
                          <button className="icon-button" onClick={() => removeBadge(badge.id)} aria-label="删除勋章">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "rewards" && (
            <div className="space-y-5">
              <Header title="积分奖励" subtitle={`当前有 ${state.points} 积分，可以兑换喜欢的小奖励。`} />
              {userRole === "parent" && (
                <Panel title={editingRewardId ? "修改奖励" : "添加奖励"}>
                  <div className="reward-form">
                    <input className="input" placeholder="奖励名称" value={rewardDraft.title} onChange={(event) => setRewardDraft({ ...rewardDraft, title: event.target.value })} />
                    <NumberInput value={rewardDraft.pointsCost} suffix="兑换分" onChange={(value) => setRewardDraft({ ...rewardDraft, pointsCost: value })} />
                    <button className={rewardDraft.enabled ? "primary-button" : "secondary-button"} onClick={() => setRewardDraft({ ...rewardDraft, enabled: !rewardDraft.enabled })}>
                      {rewardDraft.enabled ? "已启用" : "已停用"}
                    </button>
                    <button className="primary-button" onClick={saveReward}>
                      <Save size={20} /> {editingRewardId ? "更新" : "添加"}
                    </button>
                  </div>
                  <textarea
                    className="input mt-3 min-h-24 w-full py-3"
                    placeholder="奖励说明，例如：周末看一集动画、选择一次晚餐"
                    value={rewardDraft.description ?? ""}
                    onChange={(event) => setRewardDraft({ ...rewardDraft, description: event.target.value })}
                  />
                  <div className="icon-picker">
                    {rewardIconOptions.map((item) => {
                      const Icon = item.icon;
                      const selected = (rewardDraft.icon ?? "Gift") === item.name;
                      return (
                        <button className={selected ? "icon-choice icon-choice-active" : "icon-choice"} key={item.name} onClick={() => setRewardDraft({ ...rewardDraft, icon: item.name })} title={item.label}>
                          <Icon size={20} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Panel>
              )}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {state.rewards.map((reward) => {
                  const RewardIcon = getRewardIcon(reward.icon);
                  return (
                    <article className={`reward-card ${reward.enabled ? "" : "reward-disabled"}`} key={reward.id}>
                      <RewardIcon size={32} />
                      <h3>{reward.title}</h3>
                      <p>{reward.description ?? "完成学习任务后兑换"}</p>
                      <button className="primary-button" disabled={!reward.enabled || state.points < reward.pointsCost} onClick={() => redeemReward(reward)}>
                        {reward.pointsCost} 分兑换
                      </button>
                      {userRole === "parent" && (
                        <div className="mt-3 flex gap-2">
                          <button className="secondary-button flex-1" onClick={() => editReward(reward)}>
                            <Pencil size={18} /> 修改
                          </button>
                          <button className="icon-button" onClick={() => removeReward(reward.id)} aria-label="删除奖励">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <Panel title="积分流水">
                <div className="ledger-filter">
                  <select className="input" value={ledgerRange} onChange={(event) => setLedgerRange(event.target.value as LedgerRange)}>
                    <option value="7d">最近 7 天</option>
                    <option value="30d">最近 30 天</option>
                    <option value="all">全部流水</option>
                    <option value="custom">自定义日期</option>
                  </select>
                  {ledgerRange === "custom" && (
                    <>
                      <label className="input flex items-center gap-3">
                        <span className="shrink-0 text-sm text-slate-500">从</span>
                        <input className="w-full bg-transparent outline-none" type="date" value={ledgerDateFrom} onChange={(event) => setLedgerDateFrom(event.target.value)} />
                      </label>
                      <label className="input flex items-center gap-3">
                        <span className="shrink-0 text-sm text-slate-500">到</span>
                        <input className="w-full bg-transparent outline-none" type="date" value={ledgerDateTo} onChange={(event) => setLedgerDateTo(event.target.value)} />
                      </label>
                    </>
                  )}
                </div>
                {userRole === "parent" && (
                  <div className="ledger-form">
                    <input className="input" placeholder="积分条目内容" value={ledgerDraft.reason} onChange={(event) => setLedgerDraft({ ...ledgerDraft, reason: event.target.value })} />
                    <input className="input" type="number" aria-label="积分，可以是负数" placeholder="积分，可以是负数" value={ledgerDraft.points} onChange={(event) => setLedgerDraft({ ...ledgerDraft, points: Number(event.target.value) })} />
                    <button className="primary-button" onClick={saveManualLedger}>
                      <Plus size={20} /> 添加
                    </button>
                  </div>
                )}
                <div className="grid gap-2">
                  {filteredLedger.map((row) => (
                    <div className="ledger-row" key={row.id}>
                      <div className="ledger-row-content">
                        <time>{formatDateTime(row.createdAt)}</time>
                        <span>{row.reason}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong className={row.points >= 0 ? "text-green-600" : "text-red-500"}>{row.points > 0 ? `+${row.points}` : row.points}</strong>
                        {userRole === "parent" && (
                          <button className="icon-button" onClick={() => removeLedger(row.id)} aria-label="删除积分条目">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredLedger.length === 0 && <EmptyText text="这个时间范围内还没有积分流水。" />}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === "subjects" && (
            <div className="space-y-5">
              <Header title="科目设置" subtitle="给每个科目设置颜色，并决定是否显示在首页成绩趋势里。" />
              <Panel title={subjectDraft.id ? "修改科目" : "添加科目"}>
                <div className="grid gap-3 lg:grid-cols-[1fr_120px_150px_140px]">
                  <input className="input" placeholder="科目名称" value={subjectDraft.name} onChange={(event) => setSubjectDraft({ ...subjectDraft, name: event.target.value })} />
                  <input className="input h-12" type="color" value={subjectDraft.color} onChange={(event) => setSubjectDraft({ ...subjectDraft, color: event.target.value })} />
                  <button
                    className={subjectDraft.showOnHome ? "primary-button" : "secondary-button"}
                    onClick={() => setSubjectDraft({ ...subjectDraft, showOnHome: !subjectDraft.showOnHome })}
                  >
                    {subjectDraft.showOnHome ? "首页显示" : "首页隐藏"}
                  </button>
                  <button className="primary-button" onClick={saveSubject}>
                    <Save size={20} /> 保存
                  </button>
                </div>
              </Panel>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {subjects.map((subject) => (
                  <article className="row-card" key={subject.id}>
                    <div>
                      <span className="pill" style={{ backgroundColor: `${subject.color}22`, color: subject.color }}>
                        {subject.name}
                      </span>
                      <p className="mt-2 font-bold text-slate-600">{subject.showOnHome ? "显示在首页趋势" : "不显示在首页趋势"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="secondary-button" onClick={() => setSubjectDraft(subject)}>
                        修改
                      </button>
                      <button className="danger-button" onClick={() => removeSubject(subject)}>
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-5">
              <Header title="设置与备份" subtitle="学习数据保存在 Supabase，JSON 备份可用于额外保险。" />
              <Panel title="页面主题">
                <p className="mb-4 font-bold text-slate-600">选择一种喜欢的成长星球外观。主题只保存在当前设备，不会影响学习数据。</p>
                <ThemePicker expanded value={theme} onChange={setTheme} />
              </Panel>
              <Panel title="家庭数据源">
                <div className="space-y-4">
                  <p className="rounded-2xl bg-blue-50 p-4 text-blue-900">
                    当前数据直接保存在 Supabase。不同设备输入同一个家庭同步码，就会读取同一份学习数据。
                  </p>
                  <div className="grid gap-3 lg:grid-cols-[1fr_140px]">
                    <input className="input" value={familyCodeDraft} onChange={(event) => setFamilyCodeDraft(event.target.value)} placeholder="家庭同步码" />
                    <button className="primary-button" disabled={isCloudBusy || !familyCodeDraft.trim()} onClick={saveFamilyCode}>
                      <Save size={20} /> 使用
                    </button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1fr_140px]">
                    <input
                      className="input"
                      placeholder="家长密码"
                      type="password"
                      value={settingsDraft.parentPassword ?? "admin"}
                      onChange={(event) => setSettingsDraft({ ...settingsDraft, parentPassword: event.target.value || "admin" })}
                    />
                    <button className="secondary-button" onClick={saveSettings}>
                      保存密码
                    </button>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1fr_140px]">
                    <label className="input flex items-center gap-3">
                      <span className="shrink-0 text-sm text-slate-500">成就统计从</span>
                      <input className="w-full bg-transparent outline-none" type="date" value={settingsDraft.badgeStartDate ?? today()} onChange={(event) => setSettingsDraft({ ...settingsDraft, badgeStartDate: event.target.value })} />
                    </label>
                    <button className="secondary-button" onClick={saveSettings}>
                      保存日期
                    </button>
                  </div>
                  <p className="rounded-2xl bg-slate-50 p-4 font-bold text-slate-700">
                    {isCloudBusy && <Loader2 className="mr-2 inline animate-spin" size={18} />}
                    {cloudStatus}
                  </p>
                </div>
              </Panel>
              <Panel title="数据备份">
                <div className="flex flex-wrap gap-3">
                  <button className="primary-button" onClick={downloadBackup}>
                    <Download size={20} /> 导出 JSON
                  </button>
                  <label className="secondary-button cursor-pointer">
                    <Upload size={20} /> 合并导入
                    <input className="hidden" type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && void importBackup(event.target.files[0], "merge")} />
                  </label>
                  <label className="danger-button cursor-pointer">
                    <RotateCcw size={20} /> 覆盖导入
                    <input className="hidden" type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && void importBackup(event.target.files[0], "overwrite")} />
                  </label>
                </div>
              </Panel>
              <Panel title="百度云 OCR">
                <div className="space-y-4">
                  <p className="rounded-2xl bg-yellow-50 p-4 text-yellow-900">
                    GitHub Pages 浏览器直连百度云会被 CORS 拦截。当前使用 Supabase 云端代理识别，百度密钥保存在 Supabase secrets。
                  </p>
                  <input
                    className="input w-full"
                    placeholder={DEFAULT_OCR_PROXY_URL}
                    value={normalizeOcrSettings(settingsDraft.baiduOcr)?.proxyUrl ?? DEFAULT_OCR_PROXY_URL}
                    onChange={(event) => setSettingsDraft({ ...settingsDraft, baiduOcr: { mode: "proxy", proxyUrl: event.target.value || DEFAULT_OCR_PROXY_URL } })}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="primary-button" onClick={saveSettings}>
                      <Save size={20} /> 保存 OCR 配置
                    </button>
                    <button className="secondary-button" onClick={testOcrSettings}>
                      测试 OCR 配置
                    </button>
                  </div>
                  {ocrWarning && <p className="rounded-2xl bg-blue-50 p-4 text-blue-900">{ocrWarning}</p>}
                </div>
              </Panel>
            </div>
          )}
        </section>
      </div>
      {taskToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-blue-950/70 p-4">
          <section className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-soft">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-500">
              <Trash2 size={28} />
            </div>
            <h2 className="mt-4 text-center text-2xl font-black">确认删除作业？</h2>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-center font-bold text-slate-600">
              {taskToDelete.category} · {taskToDelete.title}
            </p>
            <p className="mt-3 text-center text-sm font-bold text-slate-500">删除后不会再显示在计划和统计里。</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button className="secondary-button justify-center" disabled={busyTaskId === taskToDelete.id} onClick={() => setTaskToDelete(null)}>
                取消
              </button>
              <button className="danger-button justify-center" disabled={busyTaskId === taskToDelete.id} onClick={() => deleteTask(taskToDelete)}>
                {busyTaskId === taskToDelete.id ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                {busyTaskId === taskToDelete.id ? "正在删除" : "确认删除"}
              </button>
            </div>
          </section>
        </div>
      )}
      {repeatTaskAction && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-blue-950/70 p-4">
          <section className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-soft">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              {repeatTaskAction.action === "edit" ? <Pencil size={28} /> : <Trash2 size={28} />}
            </div>
            <h2 className="mt-4 text-center text-2xl font-black">{repeatTaskAction.action === "edit" ? "修改重复作业" : "删除重复作业"}</h2>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-center font-bold text-slate-600">
              {repeatTaskAction.task.category} · {repeatTaskAction.task.title}
              <br />
              <span className="text-sm text-slate-500">重复周期：{getRepeatCycleLabel(repeatTaskAction.task, state.tasks)}</span>
            </p>
            <div className="mt-5 grid gap-3">
              {!isRepeatTemplateTask(repeatTaskAction.task) && (
                <button
                  className={repeatTaskAction.action === "edit" ? "secondary-button justify-center" : "danger-button justify-center"}
                  disabled={busyTaskId === repeatTaskAction.task.id}
                  onClick={() => (repeatTaskAction.action === "edit" ? editRepeatTask(repeatTaskAction.task, "single") : deleteTask(repeatTaskAction.task, "single"))}
                >
                  {repeatTaskAction.action === "edit" ? "只修改这一次" : "只删除这一次"}
                </button>
              )}
              <button
                className={repeatTaskAction.action === "edit" ? "primary-button justify-center" : "danger-button justify-center"}
                disabled={busyTaskId === repeatTaskAction.task.id}
                onClick={() => (repeatTaskAction.action === "edit" ? editRepeatTask(repeatTaskAction.task, "series") : deleteTask(repeatTaskAction.task, "series"))}
              >
                {busyTaskId === repeatTaskAction.task.id ? <Loader2 className="animate-spin" size={20} /> : repeatTaskAction.action === "edit" ? <Pencil size={20} /> : <Trash2 size={20} />}
                {repeatTaskAction.action === "edit" ? "修改整个重复序列" : "删除整个重复序列"}
              </button>
              <button className="secondary-button justify-center" disabled={busyTaskId === repeatTaskAction.task.id} onClick={() => setRepeatTaskAction(null)}>
                取消
              </button>
            </div>
          </section>
        </div>
      )}
      {taskStartConflict && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-blue-950/70 p-4">
          <section className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-soft">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <Clock size={28} />
            </div>
            <h2 className="mt-4 text-center text-2xl font-black">已有作业正在进行</h2>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-center font-bold text-slate-600">
              是否暂停「{taskStartConflict.runningTask.title}」作业，并开始「{taskStartConflict.nextTask.title}」？
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button className="secondary-button justify-center" disabled={busyTaskId === taskStartConflict.runningTask.id} onClick={() => setTaskStartConflict(null)}>
                取消
              </button>
              <button className="primary-button justify-center" disabled={busyTaskId === taskStartConflict.runningTask.id} onClick={confirmStartAfterPause}>
                {busyTaskId === taskStartConflict.runningTask.id ? <Loader2 className="animate-spin" size={20} /> : <Clock size={20} />}
                {busyTaskId === taskStartConflict.runningTask.id ? "正在切换" : "暂停并开始"}
              </button>
            </div>
          </section>
        </div>
      )}
      {focusTask && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-blue-950/70 p-4">
          <section className="w-full max-w-2xl rounded-[32px] bg-white p-6 text-center shadow-soft">
            <p className="font-black text-blue-600">{focusTask.category}</p>
            <h2 className="mt-3 text-3xl font-black sm:text-5xl">{focusTask.title}</h2>
            <div className="mx-auto mt-6 grid size-52 place-items-center rounded-full bg-blue-50">
              <div>
                <p className="text-6xl font-black text-blue-600">{getTaskElapsedMinutes(focusTask)}</p>
                <p className="mt-1 font-bold text-slate-500">分钟</p>
              </div>
            </div>
            <p className="mt-4 text-lg font-bold text-slate-600">计划 {focusTask.plannedMinutes ?? 0} 分钟 · 按时完成 +1 分</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {focusTask.status !== "running" && (
                <button
                  className="secondary-button"
                  onClick={async () => {
                    const started = await startTask(focusTask);
                    if (started) setFocusTask({ ...focusTask, status: "running", startTime: nowIso() });
                  }}
                >
                  <Clock size={20} /> {focusTask.status === "paused" ? "继续专注" : "开始专注"}
                </button>
              )}
              {focusTask.status === "running" && (
                <button
                  className="secondary-button"
                  onClick={async () => {
                    await pauseTask(focusTask);
                    setFocusTask({ ...focusTask, status: "paused", actualMinutes: getTaskElapsedMinutes(focusTask), startTime: undefined });
                  }}
                >
                  <Clock size={20} /> 暂停
                </button>
              )}
              <button
                className="success-button"
                onClick={async () => {
                  await completeTask(focusTask);
                  setFocusTask(null);
                }}
              >
                <CheckCircle2 size={20} /> 完成任务
              </button>
              <button className="danger-button" onClick={() => setFocusTask(null)}>
                退出
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="app-header rounded-[30px] p-5 shadow-soft">
      <h2 className="mt-1 text-3xl font-black tracking-normal sm:text-4xl">{title}</h2>
      <p className="mt-2 text-lg text-slate-600">{subtitle}</p>
    </header>
  );
}

function Metric({ title, value, suffix, tone }: { title: string; value: string; suffix: string; tone: "blue" | "green" | "yellow" | "purple" }) {
  return (
    <article className={`metric metric-${tone}`}>
      <p>{title}</p>
      <strong>{value}</strong>
      <span>{suffix}</span>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-panel rounded-[28px] p-5 shadow-soft">
      <h2 className="mb-4 text-2xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function ChartBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`h-72 min-w-0 w-full ${className}`}>{children}</div>;
}

function ThemePicker({ value, onChange, compact = false, expanded = false }: { value: ThemeId; onChange: (theme: ThemeId) => void; compact?: boolean; expanded?: boolean }) {
  if (compact) {
    return (
      <div className="theme-picker-compact" aria-label="快速切换页面主题">
        {themeOptions.map((theme) => (
          <button
            type="button"
            key={theme.id}
            className={value === theme.id ? "theme-swatch theme-swatch-active" : "theme-swatch"}
            style={{ "--swatch-main": theme.colors[0], "--swatch-soft": theme.colors[1] } as React.CSSProperties}
            onClick={() => onChange(theme.id)}
            aria-label={`使用${theme.name}主题`}
            aria-pressed={value === theme.id}
            title={theme.name}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={expanded ? "theme-picker theme-picker-expanded" : "theme-picker"}>
      {themeOptions.map((theme) => {
        const ThemeIcon = theme.icon;
        return (
          <button
            type="button"
            key={theme.id}
            className={value === theme.id ? "theme-choice theme-choice-active" : "theme-choice"}
            onClick={() => onChange(theme.id)}
            aria-pressed={value === theme.id}
          >
            <span className="theme-choice-icon" style={{ backgroundColor: theme.colors[1], color: theme.colors[0] }}><ThemeIcon size={22} /></span>
            <span><strong>{theme.name}</strong>{expanded && <small>{theme.description}</small>}</span>
          </button>
        );
      })}
    </div>
  );
}

type ScoreTrendPoint = {
  id: string;
  date: string;
  label: string;
  subject: string;
  examName: string;
  score: number;
  color: string;
};

type ScoreTrendRow = { date: string; label: string } & Record<string, string | number>;

type StudyTimelineEntry = {
  id: string;
  title: string;
  category: string;
  startMinute: number;
  endMinute: number;
  startLabel: string;
  endLabel: string;
  durationMinutes: number;
  estimated: boolean;
  running: boolean;
};

type StudyTimelineDay = { date: string; entries: StudyTimelineEntry[] };

function StudyTimeline({ days, subjects }: { days: StudyTimelineDay[]; subjects: Subject[] }) {
  const [tooltip, setTooltip] = useState<{ entry: StudyTimelineEntry; x: number; y: number } | null>(null);
  const entries = days.flatMap((day) => day.entries);
  if (entries.length === 0) return <EmptyText text="这个范围内还没有可显示的计时记录。开始作业计时后，这里会出现具体时间段。" />;

  const earliest = Math.min(...entries.map((entry) => entry.startMinute));
  const latest = Math.max(...entries.map((entry) => entry.endMinute));
  let rangeStart = Math.max(0, Math.floor(earliest / 60) * 60);
  let rangeEnd = Math.min(1440, Math.ceil(latest / 60) * 60);
  if (rangeEnd - rangeStart < 360) {
    const padding = 360 - (rangeEnd - rangeStart);
    rangeStart = Math.max(0, rangeStart - Math.floor(padding / 2));
    rangeEnd = Math.min(1440, rangeStart + 360);
    rangeStart = Math.max(0, rangeEnd - 360);
  }
  const ticks = Array.from({ length: 5 }, (_, index) => rangeStart + ((rangeEnd - rangeStart) * index) / 4);

  return (
    <div>
      <div className="timeline-note">
        <Clock size={18} /> 色块表示实际计时区间；虚线色块为根据实际耗时回推的旧记录。
      </div>
      <div className="timeline-scroll">
        <div className="study-timeline">
          <div className="timeline-axis-label" />
          <div className="timeline-axis">
            {ticks.map((minute) => <span key={minute} style={{ left: `${((minute - rangeStart) / (rangeEnd - rangeStart)) * 100}%` }}>{formatClockMinute(minute)}</span>)}
          </div>
          {days.map((day) => (
            <div className="timeline-row" key={day.date}>
              <div className="timeline-day-label">
                <strong>{day.date.slice(5)}</strong>
                <span>{getChineseWeekday(day.date)}</span>
              </div>
              <div className="timeline-track">
                {ticks.map((minute) => <i className="timeline-gridline" key={minute} style={{ left: `${((minute - rangeStart) / (rangeEnd - rangeStart)) * 100}%` }} />)}
                {day.entries.map((entry) => {
                  const left = ((Math.max(entry.startMinute, rangeStart) - rangeStart) / (rangeEnd - rangeStart)) * 100;
                  const width = Math.max(1.5, ((Math.min(entry.endMinute, rangeEnd) - Math.max(entry.startMinute, rangeStart)) / (rangeEnd - rangeStart)) * 100);
                  return (
                    <div
                      className={`timeline-block ${entry.estimated ? "timeline-block-estimated" : ""} ${entry.running ? "timeline-block-running" : ""}`}
                      key={entry.id}
                      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: getSubjectColor(subjects, entry.category) ?? "#6366f1" }}
                      tabIndex={0}
                      role="img"
                      aria-label={`${entry.title}，${entry.category}，${entry.startLabel} 到 ${entry.endLabel}，${entry.durationMinutes} 分钟`}
                      onMouseEnter={(event) => setTooltip({ entry, x: clampTimelineTooltipX(event.clientX), y: event.clientY - 12 })}
                      onMouseMove={(event) => setTooltip({ entry, x: clampTimelineTooltipX(event.clientX), y: event.clientY - 12 })}
                      onMouseLeave={() => setTooltip(null)}
                      onFocus={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setTooltip({ entry, x: clampTimelineTooltipX(rect.left + rect.width / 2), y: rect.top - 12 });
                      }}
                      onBlur={() => setTooltip(null)}
                    >
                      <span>{entry.title}</span><small>{entry.startLabel}–{entry.endLabel}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {tooltip && (
        <div className="timeline-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.entry.title}</strong>
          <span>{tooltip.entry.category} · {tooltip.entry.running ? "进行中" : "已完成"}</span>
          <span>{tooltip.entry.startLabel}–{tooltip.entry.endLabel} · {tooltip.entry.durationMinutes} 分钟</span>
          <small>{tooltip.entry.estimated ? "旧记录：时间段由实际耗时回推" : "计时记录：准确开始和结束时间"}</small>
        </div>
      )}
    </div>
  );
}

function clampTimelineTooltipX(x: number) {
  return Math.min(window.innerWidth - 150, Math.max(150, x));
}

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 p-4 text-slate-500">{text}</p>;
}

function NumberInput({ value, onChange, suffix, className = "" }: { value: number; onChange: (value: number) => void; suffix?: string; className?: string }) {
  return (
    <label className={`input flex items-center gap-2 ${className}`}>
      <input className="w-full bg-transparent outline-none" type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      {suffix && <span className="shrink-0 text-sm text-slate-500">{suffix}</span>}
    </label>
  );
}

function getRewardIcon(iconName?: string) {
  return rewardIconOptions.find((item) => item.name === iconName)?.icon ?? Gift;
}

function getBadgeIcon(iconName?: string) {
  return badgeIconOptions.find((item) => item.name === iconName)?.icon ?? Medal;
}

function getBadgeConditionLabel(conditionType: string) {
  return badgeConditionOptions.find((item) => item.value === conditionType)?.label ?? "目标";
}

function sortTasks(tasks: Task[], sort: TaskSort, subjects: Subject[]) {
  return [...tasks].sort((left, right) => compareTasks(left, right, sort, subjects));
}

function compareTasks(left: Task, right: Task, sort: TaskSort, subjects: Subject[]) {
  const fallback = () => compareTaskStart(left, right) || left.title.localeCompare(right.title, "zh-Hans-CN") || left.id.localeCompare(right.id);
  if (sort === "time") return compareTaskStart(left, right) || compareTaskStatus(left, right) || fallback();
  if (sort === "subject") return compareTaskSubject(left, right, subjects) || compareTaskDefault(left, right) || fallback();
  if (sort === "type") return compareTaskType(left, right) || compareTaskDefault(left, right) || fallback();
  if (sort === "status") return compareTaskStatus(left, right) || fallback();
  return compareTaskDefault(left, right) || fallback();
}

function compareTaskDefault(left: Task, right: Task) {
  return compareTaskCompletion(left, right) || compareTaskStart(left, right);
}

function compareTaskCompletion(left: Task, right: Task) {
  return getTaskCompletionRank(left) - getTaskCompletionRank(right);
}

function compareTaskStatus(left: Task, right: Task) {
  return getTaskStatusRank(left) - getTaskStatusRank(right);
}

function compareTaskStart(left: Task, right: Task) {
  return getTaskStartSortValue(left).localeCompare(getTaskStartSortValue(right));
}

function compareTaskSubject(left: Task, right: Task, subjects: Subject[]) {
  return getSubjectSortRank(subjects, left.category) - getSubjectSortRank(subjects, right.category) || left.category.localeCompare(right.category, "zh-Hans-CN");
}

function compareTaskType(left: Task, right: Task) {
  return (left.assignmentType ?? "").localeCompare(right.assignmentType ?? "", "zh-Hans-CN");
}

function getTaskCompletionRank(task: Task) {
  return task.status === "completed" ? 1 : 0;
}

function getTaskStatusRank(task: Task) {
  const ranks: Record<Task["status"], number> = { running: 0, paused: 1, pending: 2, expired: 3, completed: 4 };
  return ranks[task.status] ?? 99;
}

function getTaskStartSortValue(task: Task) {
  return `${task.startDate}T${getTaskLocalTimePart(task.startTime) ?? "00:00:00"}`;
}

function getTaskLocalTimePart(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.includes("T") ? value.split("T")[1]?.slice(0, 8) : value.slice(0, 8);
  return date.toTimeString().slice(0, 8);
}

function getSubjectSortRank(subjects: Subject[], name: string) {
  return subjects.find((subject) => subject.name === name)?.sortOrder ?? 999;
}

function withOcrDraftIds(drafts: OcrDraftTask[]): OcrDraftItem[] {
  return drafts.map((draft) => ({
    ...draft,
    assignmentType: draft.assignmentType ?? "课堂作业",
    draftId: crypto.randomUUID(),
  }));
}

function getNextTaskDraft(draft: Omit<Task, "id" | "createdAt">, currentDate = today()): Omit<Task, "id" | "createdAt"> {
  const points = normalizeTaskPoints(draft);
  const startDate = draft.startDate < currentDate ? currentDate : draft.startDate;
  return {
    ...points,
    title: "",
    description: "",
    actualMinutes: 0,
    startTime: undefined,
    endTime: undefined,
    status: "pending",
    startDate,
    endDate: draft.endDate && draft.endDate < startDate ? undefined : draft.endDate,
  };
}

function toggleTaskPoints(draft: Omit<Task, "id" | "createdAt">): Omit<Task, "id" | "createdAt"> {
  if (draft.autoComplete) {
    return { ...draft, autoComplete: false, rewardPoints: 0, penaltyPoints: 0, overduePoints: 0 };
  }
  return { ...draft, autoComplete: true, rewardPoints: draft.rewardPoints || 1, penaltyPoints: draft.penaltyPoints || 1, overduePoints: draft.overduePoints || 0 };
}

function normalizeTaskPoints<T extends Pick<Task, "autoComplete" | "rewardPoints" | "penaltyPoints" | "overduePoints">>(task: T): T {
  if (task.autoComplete) {
    return {
      ...task,
      rewardPoints: Number(task.rewardPoints) || 0,
      penaltyPoints: Number(task.penaltyPoints) || 0,
      overduePoints: Number(task.overduePoints) || 0,
    };
  }
  return { ...task, rewardPoints: 0, penaltyPoints: 0, overduePoints: 0 };
}

function toEditableTaskPatch(task: Task) {
  return {
    ...task,
    endDate: task.endDate ?? null,
    startTime: task.startTime ?? null,
    endTime: task.endTime ?? null,
    repeatDays: task.repeatDays ?? null,
  };
}

function filterLedger(ledger: PointLedger[], range: LedgerRange, customFrom: string, customTo: string) {
  const sorted = [...ledger].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  if (range === "all") return sorted;
  const todayDate = today();
  const from = range === "custom" ? customFrom : addLocalDays(todayDate, range === "30d" ? -29 : -6);
  const to = range === "custom" ? customTo : todayDate;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return sorted.filter((row) => {
    const date = getLocalDateFromIso(row.createdAt);
    return start <= date && date <= end;
  });
}

function getTaskElapsedMinutes(task: Task) {
  if (task.status === "running" && task.startTime) {
    return (task.actualMinutes ?? 0) + getTaskRunMinutes(task);
  }
  return task.actualMinutes ?? 0;
}

function getTaskActualMinutesOnComplete(task: Task) {
  if (task.status !== "running" || !task.startTime) return task.actualMinutes ?? 0;
  const runningDate = getLocalDateFromIso(task.startTime);
  const elapsed = runningDate < today() ? getTaskRunMinutesUntilEndOfStartDay(task) : getTaskRunMinutes(task);
  return (task.actualMinutes ?? 0) + elapsed;
}

function getTaskMinutesForDate(task: Task, date: string) {
  if (task.status === "completed") {
    return isTaskCompletedOnDate(task, date) ? task.actualMinutes ?? 0 : 0;
  }
  if (task.status === "running" && task.startTime) {
    return getLocalDateFromIso(task.startTime) === date ? getTaskElapsedMinutes(task) : 0;
  }
  return task.startDate === date ? task.actualMinutes ?? 0 : 0;
}

function getTaskPlannedMinutesForDate(task: Task, date: string) {
  const plannedMinutes = task.plannedMinutes ?? 0;
  if (!isMultiDaySingleTask(task)) return task.startDate === date ? plannedMinutes : 0;
  if (getTaskEffectivePlanDate(task) !== date) return 0;
  if (task.dailyPlans?.[date] !== undefined) return task.dailyPlans[date];
  if (task.status === "completed") return plannedMinutes;
  return Math.max(0, plannedMinutes - (task.actualMinutes ?? 0));
}

function getTaskTodoCountForDate(task: Task, date: string) {
  if (!isMultiDaySingleTask(task)) return task.startDate === date ? 1 : 0;
  return getTaskEffectivePlanDate(task) === date ? 1 : 0;
}

function getTaskEffectivePlanDate(task: Task) {
  if (!isMultiDaySingleTask(task)) return task.startDate;
  const completedDate = getTaskCompletedDate(task);
  if (completedDate) return completedDate;
  const dueDate = task.endDate ?? task.startDate;
  const todayDate = today();
  if (todayDate < task.startDate) return task.startDate;
  if (todayDate > dueDate) return dueDate;
  return todayDate;
}

function isMultiDaySingleTask(task: Task) {
  return task.repeatType === "none" && Boolean(task.endDate && task.endDate > task.startDate);
}

function getTaskRunMinutes(task: Task) {
  if (task.status !== "running" || !task.startTime) return 0;
  const startedAt = new Date(task.startTime).getTime();
  return getElapsedWholeMinutes(startedAt);
}

function getTaskRunMinutesUntilEndOfStartDay(task: Task) {
  if (!task.startTime) return 0;
  const startedAt = new Date(task.startTime);
  if (Number.isNaN(startedAt.getTime())) return 0;
  const endOfStartDay = new Date(startedAt);
  endOfStartDay.setHours(24, 0, 0, 0);
  const endedAt = Math.min(endOfStartDay.getTime(), Date.now());
  return Math.max(0, Math.floor((endedAt - startedAt.getTime()) / 60000));
}

function getElapsedWholeMinutes(startedAt: number) {
  if (Number.isNaN(startedAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
}

function taskOverlapsDate(task: Task, date: string, deletedTaskIds: Set<string> = new Set()) {
  if (isRepeatOccurrenceDeletedOnDate(task, date, deletedTaskIds)) return false;
  if (task.repeatType !== "none") return task.startDate === date;
  const endDate = getTaskVisibleEndDate(task);
  return task.startDate <= date && date <= endDate;
}

function isTaskCompletedOnDate(task: Task, date: string) {
  return task.status === "completed" && getTaskCompletedDate(task) === date;
}

function getTaskCompletedDate(task: Task) {
  if (task.status !== "completed") return undefined;
  return task.endTime ? getLocalDateFromIso(task.endTime) : task.startDate;
}

function getTaskVisibleEndDate(task: Task) {
  const scheduledEndDate = task.endDate || task.startDate;
  const completedDate = getTaskCompletedDate(task);
  if (completedDate && completedDate < scheduledEndDate) return completedDate;
  return scheduledEndDate;
}

function getLocalDateFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return toLocalDateInputValue(date);
}

function isTaskOverdue(task: Task) {
  return getTaskDueDate(task) < today();
}

function getTaskDueDate(task: Task) {
  return task.repeatType !== "none" ? task.startDate : task.endDate || task.startDate;
}

function getRepeatOccurrenceDates(task: Task, todayDate: string) {
  if (task.repeatType === "none") return [];
  const endDate = task.endDate && task.endDate < todayDate ? task.endDate : todayDate;
  if (endDate <= task.startDate) return [];
  const dates: string[] = [];
  for (let date = addLocalDays(task.startDate, 1); date <= endDate; date = addLocalDays(date, 1)) {
    if (isRepeatDate(task, date)) {
      dates.push(date);
    }
  }
  return dates;
}

function buildRepeatSeriesTasks(task: Task) {
  if (task.repeatType === "none") return [task];
  const dates = [...(isRepeatDate(task, task.startDate) ? [task.startDate] : []), ...getRepeatOccurrenceDates(task, getRepeatSeriesEndDate(task))];
  return (dates.length > 0 ? dates : [task.startDate]).map((date, index) => ({
    ...task,
    id: index === 0 ? task.id : getRepeatInstanceId(task, date),
    startDate: date,
    status: "pending" as const,
    actualMinutes: 0,
    startTime: undefined,
    endTime: undefined,
    createdAt: index === 0 ? task.createdAt : nowIso(),
  }));
}

function getRepeatSeriesEndDate(task: Task) {
  return task.endDate ?? addLocalDays(task.startDate, defaultRepeatHorizonDays);
}

function isRepeatDate(task: Task, date: string) {
  if (task.repeatType === "daily") return true;
  if (task.repeatType !== "weekly") return false;
  if (!task.repeatDays || task.repeatDays.length === 0) return date === task.startDate;
  const mondayFirstWeekday = (parseLocalDate(date).getDay() + 6) % 7;
  return task.repeatDays.includes(mondayFirstWeekday);
}

function getRepeatInstanceId(task: Task, date: string) {
  return `repeat:${task.id}:${date}`;
}

function getRepeatSeriesId(task: Task) {
  if (!task.id.startsWith("repeat:")) return undefined;
  const [, templateId] = task.id.split(":");
  return templateId || undefined;
}

function getRepeatRootId(task: Task) {
  return getRepeatSeriesId(task) ?? (task.repeatType !== "none" ? task.id : undefined);
}

function getRepeatTemplateForTask(task: Task, tasks: Task[]) {
  const rootId = getRepeatRootId(task);
  return rootId ? tasks.find((item) => item.id === rootId) : undefined;
}

function isRepeatGeneratedInstanceTask(task: Task) {
  return task.id.startsWith("repeat:");
}

function isRepeatTemplateTask(task: Task) {
  return false;
}

function isRepeatInstanceTask(task: Task) {
  return task.id.startsWith("repeat:");
}

function isRepeatRelatedTask(task: Task, tasks: Task[]) {
  const rootId = getRepeatRootId(task);
  if (!rootId) return false;
  return task.repeatType !== "none" || tasks.some((item) => item.id !== task.id && (item.id === rootId || item.id.startsWith(`repeat:${rootId}:`)));
}

function getRepeatSeriesTasks(task: Task, tasks: Task[], fromDate = task.startDate) {
  const rootId = getRepeatRootId(task);
  if (!rootId) return [task];
  return tasks.filter((item) => (item.id === rootId || item.id.startsWith(`repeat:${rootId}:`)) && item.startDate >= fromDate);
}

function getRepeatDeletionIdForTask(task: Task) {
  return getRepeatRootId(task) ? task.id : undefined;
}

function isRepeatOccurrenceDeletedOnDate(task: Task, date: string, deletedTaskIds: Set<string>) {
  if (deletedTaskIds.size === 0) return false;
  return task.startDate === date && deletedTaskIds.has(task.id);
}

function getRepeatCycleLabel(task: Task, tasks: Task[]) {
  const template = getRepeatTemplateForTask(task, tasks) ?? task;
  if (template.repeatType === "daily") return "每天";
  if (template.repeatType === "weekly") return `每周${getRepeatWeekdaysLabel(template.repeatDays)}`;
  return "重复";
}

function getRepeatWeekdaysLabel(days?: number[]) {
  if (!days || days.length === 0) return "";
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  return days.map((day) => labels[day] ?? "").join("、");
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateText: string) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function addLocalDays(dateText: string, days: number) {
  const date = parseLocalDate(dateText);
  date.setDate(date.getDate() + days);
  return toLocalDateInputValue(date);
}

function buildStudyTimeline(tasks: Task[], dates: string[], deletedTaskIds: Set<string>): StudyTimelineDay[] {
  const dateSet = new Set(dates);
  const map = new Map(dates.map((date) => [date, [] as StudyTimelineEntry[]]));

  for (const task of tasks) {
    let start: Date | undefined;
    let end: Date | undefined;
    let estimated = false;
    let running = false;

    if (task.status === "running" && task.startTime) {
      start = new Date(task.startTime);
      end = new Date();
      running = true;
    } else if (task.status === "completed" && task.endTime) {
      end = new Date(task.endTime);
      if (task.startTime) start = new Date(task.startTime);
      const recordedMinutes = Math.max(1, task.actualMinutes ?? 0);
      const intervalMinutes = start && !Number.isNaN(start.getTime()) ? Math.floor((end.getTime() - start.getTime()) / 60000) : 0;
      if (!start || Number.isNaN(start.getTime()) || start > end || recordedMinutes > intervalMinutes + 1) {
        start = new Date(end.getTime() - recordedMinutes * 60000);
        estimated = true;
      }
    }

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;

    for (let date = toLocalDateInputValue(start); date <= toLocalDateInputValue(end); date = addLocalDays(date, 1)) {
      if (!dateSet.has(date) || isRepeatOccurrenceDeletedOnDate(task, date, deletedTaskIds)) continue;
      const dayStart = parseLocalDate(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const segmentStart = new Date(Math.max(start.getTime(), dayStart.getTime()));
      const segmentEnd = new Date(Math.min(end.getTime(), dayEnd.getTime()));
      if (segmentEnd <= segmentStart) continue;
      const startMinute = segmentStart.getHours() * 60 + segmentStart.getMinutes();
      const isMidnightEnd = segmentEnd.getTime() === dayEnd.getTime();
      const endMinute = isMidnightEnd ? 1440 : segmentEnd.getHours() * 60 + segmentEnd.getMinutes();
      map.get(date)?.push({
        id: `${task.id}-${date}`,
        title: task.title,
        category: task.category,
        startMinute,
        endMinute: Math.max(startMinute + 1, endMinute),
        startLabel: formatClockMinute(startMinute),
        endLabel: formatClockMinute(endMinute),
        durationMinutes: Math.max(1, Math.round((segmentEnd.getTime() - segmentStart.getTime()) / 60000)),
        estimated,
        running,
      });
    }
  }

  return dates.map((date) => ({ date, entries: (map.get(date) ?? []).sort((left, right) => left.startMinute - right.startMinute) }));
}

function formatClockMinute(minute: number) {
  if (minute >= 1440) return "24:00";
  const hour = Math.floor(minute / 60);
  const minutes = Math.floor(minute % 60);
  return `${`${hour}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

function getChineseWeekday(dateText: string) {
  return `周${["日", "一", "二", "三", "四", "五", "六"][parseLocalDate(dateText).getDay()]}`;
}

function getStatsWindow(dateText: string, range: "day" | "week" | "month") {
  const date = parseLocalDate(dateText);
  if (range === "day") return { start: toLocalDateInputValue(date), end: toLocalDateInputValue(date) };
  if (range === "week") {
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: toLocalDateInputValue(monday), end: toLocalDateInputValue(sunday) };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toLocalDateInputValue(start), end: toLocalDateInputValue(end) };
}

function getDateRange(start: string, end: string) {
  const days: string[] = [];
  for (let day = start; day <= end; day = addLocalDays(day, 1)) {
    days.push(day);
  }
  return days;
}

function formatDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${toLocalDateInputValue(date)} ${date.toTimeString().slice(0, 5)}`;
}

function getWeekDays(dateText: string) {
  const date = parseLocalDate(dateText);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((label, index) => {
    const item = new Date(monday);
    item.setDate(monday.getDate() + index);
    return { label, date: toLocalDateInputValue(item) };
  });
}

function formatPercent(score: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((score / total) * 100)));
}

function getTaskStatusLabel(status: Task["status"]) {
  if (status === "running") return "进行中";
  if (status === "paused") return "已暂停";
  if (status === "completed") return "已完成";
  if (status === "expired") return "已过期";
  return "未开始";
}

function getTaskStatusClass(status: Task["status"]) {
  if (status === "running") return "status-running";
  if (status === "paused") return "status-paused";
  if (status === "completed") return "status-completed";
  return "status-pending";
}

function getSubjectColor(subjects: Subject[], name: string) {
  return subjects.find((subject) => subject.name === name)?.color ?? "#2563eb";
}

function buildScoreTrend(exams: ExamRecord[], subjects: Subject[]): ScoreTrendPoint[] {
  const subjectColors = new Map(subjects.map((subject) => [subject.name, subject.color]));
  return exams
    .filter((exam) => subjectColors.has(exam.subject) && Number.isFinite(exam.score) && Number.isFinite(exam.totalScore) && exam.totalScore > 0)
    .sort((left, right) => left.examDate.localeCompare(right.examDate) || left.id.localeCompare(right.id))
    .slice(-12)
    .map((exam) => ({
      id: exam.id,
      date: exam.examDate,
      label: exam.examDate.slice(5),
      subject: exam.subject,
      examName: exam.examName,
      score: formatPercent(exam.score, exam.totalScore),
      color: subjectColors.get(exam.subject) ?? "#2563eb",
    }));
}

function buildSubjectScoreTrendRows(points: ScoreTrendPoint[]): ScoreTrendRow[] {
  const rows = new Map<string, ScoreTrendRow>();
  const counts = new Map<string, Record<string, number>>();
  for (const point of points) {
    const row = rows.get(point.date) ?? { date: point.date, label: point.label };
    const subjectCounts = counts.get(point.date) ?? {};
    const count = subjectCounts[point.subject] ?? 0;
    const current = typeof row[point.subject] === "number" ? row[point.subject] as number : 0;
    row[point.subject] = Math.round((current * count + point.score) / (count + 1));
    subjectCounts[point.subject] = count + 1;
    rows.set(point.date, row);
    counts.set(point.date, subjectCounts);
  }
  return [...rows.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function getScoreTrendDomain(points: ScoreTrendPoint[]): [number, number] {
  if (points.length === 0) return [0, 100];
  const scores = points.map((point) => point.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const padding = Math.max(5, Math.ceil((max - min) * 0.35));
  let lower = Math.max(0, Math.floor((min - padding) / 10) * 10);
  let upper = Math.min(100, Math.ceil((max + padding) / 10) * 10);
  if (upper - lower < 20) lower = Math.max(0, upper - 20);
  if (upper - lower < 20) upper = Math.min(100, lower + 20);
  return [lower, upper];
}

function getScoreTrendTicks([lower, upper]: [number, number]) {
  const ticks: number[] = [];
  for (let value = Math.ceil(lower / 10) * 10; value <= upper; value += 10) ticks.push(value);
  return ticks;
}

function normalizeTheme(value: string | null): ThemeId {
  return themeOptions.some((theme) => theme.id === value) ? value as ThemeId : "cloud";
}

function normalizeOcrSettings(config: AppSettings["baiduOcr"]): AppSettings["baiduOcr"] {
  if (!config || config.mode === "local") {
    return { mode: "proxy", proxyUrl: DEFAULT_OCR_PROXY_URL };
  }
  return { mode: "proxy", proxyUrl: config.proxyUrl || DEFAULT_OCR_PROXY_URL };
}

function loadLocalOcrSettings(): AppSettings["baiduOcr"] {
  try {
    const raw = localStorage.getItem(ocrSettingsKey);
    if (!raw) return { mode: "proxy", proxyUrl: DEFAULT_OCR_PROXY_URL };
    return normalizeOcrSettings(JSON.parse(raw) as AppSettings["baiduOcr"]);
  } catch {
    return { mode: "proxy", proxyUrl: DEFAULT_OCR_PROXY_URL };
  }
}

export default App;
