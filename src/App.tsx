import {
  Award,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Cookie,
  Download,
  Gift,
  GraduationCap,
  Gamepad2,
  Home,
  IceCreamBowl,
  Loader2,
  Medal,
  Music,
  Palette,
  Pencil,
  Plus,
  Popcorn,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Star,
  Target,
  Ticket,
  Timer,
  Trash2,
  Trophy,
  Tv,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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
  DEFAULT_FAMILY_CODE,
  deleteCloudBadge,
  deleteCloudLedger,
  deleteCloudReward,
  deleteCloudTask,
  ensureCloudSeedData,
  fetchCloudData,
  getPointBalance,
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
} from "./supabase";
import type { AppSettings, BackupData, Badge, ExamRecord, PointLedger, Reward, Subject, Task } from "./types";

type Tab = "dashboard" | "tasks" | "exams" | "stats" | "badges" | "rewards" | "subjects" | "settings";

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
  { value: "examsAbove90", label: "90 分以上考试次数" },
  { value: "examsAbove95", label: "95 分以上考试次数" },
] as const;
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

function emptyTask(): Omit<Task, "id" | "createdAt"> {
  return {
    category: "语文",
    assignmentType: "课堂作业",
    title: "",
    description: "",
    plannedMinutes: 30,
    actualMinutes: 0,
    status: "pending",
    repeatType: "none",
    startDate: today(),
    autoComplete: false,
    rewardPoints: 1,
    penaltyPoints: 1,
    overduePoints: 0,
  };
}

function App() {
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
  const [selectedTaskDate, setSelectedTaskDate] = useState(today());
  const [hideCompletedTasks, setHideCompletedTasks] = useState(false);
  const [taskSubjectFilter, setTaskSubjectFilter] = useState("全部学科");
  const [taskTypeFilter, setTaskTypeFilter] = useState("全部类别");
  const [taskStatusFilter, setTaskStatusFilter] = useState("全部状态");
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
  const [examSubjectFilter, setExamSubjectFilter] = useState("全部学科");
  const [examTypeFilter, setExamTypeFilter] = useState("全部类别");
  const [examGradeFilter, setExamGradeFilter] = useState("全部年级");
  const [examSemesterFilter, setExamSemesterFilter] = useState("全部学期");
  const [subjectDraft, setSubjectDraft] = useState<Subject>({ id: "", name: "", color: "#2563eb", showOnHome: true, sortOrder: 10 });
  const [badgeDraft, setBadgeDraft] = useState<Badge>({ id: "", name: "", description: "", icon: "Medal", unlocked: false, conditionType: "completedTasks", conditionValue: 1 });
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [ledgerDraft, setLedgerDraft] = useState({ reason: "", points: 0 });
  const [rewardDraft, setRewardDraft] = useState<Reward>({ id: "", title: "", description: "", pointsCost: 20, icon: "Gift", enabled: true });
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [statsDate, setStatsDate] = useState(today());
  const [statsRange, setStatsRange] = useState<"day" | "week" | "month">("week");
  const [ocrWarning, setOcrWarning] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrDrafts, setOcrDrafts] = useState<OcrDraftTask[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
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
      await refreshCloudBadges(familyCode, withRepeats.tasks, withRepeats.badges, withRepeats.exams, withRepeats.settings?.[0]?.badgeStartDate);
      const refreshed = await fetchCloudData(familyCode);
      const settings = refreshed.settings[0] ?? { id: "default", childName: "小朋友", badgeStartDate: today() };
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
      setCloudStatus(`已连接家庭同步码：${familyCode}`);
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "Supabase 连接失败");
    } finally {
      setIsCloudBusy(false);
    }
  };

  const ensureRepeatInstances = async (tasks: Task[]) => {
    const todayDate = today();
    const weekday = parseLocalDate(todayDate).getDay();
    const existingKeys = new Set(tasks.map((task) => `${task.startDate}::${task.category}::${task.title}`));
    const dueTemplates = tasks.filter((task) => {
      if (task.startDate >= todayDate) return false;
      if (task.repeatType === "daily") return true;
      if (task.repeatType === "weekly") return task.repeatDays?.includes(weekday);
      return false;
    });
    const creates = dueTemplates
      .filter((task) => !existingKeys.has(`${todayDate}::${task.category}::${task.title}`))
      .map((task) =>
        addCloudTask(familyCode, {
          ...task,
          id: crypto.randomUUID(),
          status: "pending",
          actualMinutes: 0,
          startTime: undefined,
          endTime: undefined,
          repeatType: "none",
          repeatDays: undefined,
          startDate: todayDate,
          createdAt: nowIso(),
        }),
      );
    await Promise.all(creates);
  };

  const applyOverduePenalties = async (tasks: Task[]) => {
    const todayDate = today();
    const overdueTasks = tasks.filter((task) => task.autoComplete && task.status !== "completed" && task.status !== "expired" && (task.endDate || task.startDate) < todayDate);
    await Promise.all(
      overdueTasks.map(async (task) => {
        await updateCloudTask(familyCode, task.id, { status: "expired" });
        if (task.penaltyPoints > 0) await addCloudLedger(familyCode, "adjust", -task.penaltyPoints, `未按期完成作业：${task.title}`);
      }),
    );
  };

  useEffect(() => {
    void load();
  }, [familyCode]);

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

  const todayTasks = state.tasks.filter((task) => taskOverlapsDate(task, today()));
  const subjects = state.subjects.length > 0 ? state.subjects : fallbackSubjects;
  const visibleSubjects = subjects.filter((subject) => subject.showOnHome);
  const visibleTabs = tabs.filter((tab) => userRole === "parent" || !["subjects", "settings"].includes(tab.id));
  const completedToday = todayTasks.filter((task) => task.status === "completed");
  const studyMinutesToday = todayTasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);
  const completionRate = todayTasks.length === 0 ? 0 : Math.round((completedToday.length / todayTasks.length) * 100);
  const filteredTasks = state.tasks.filter(
    (task) =>
      taskOverlapsDate(task, selectedTaskDate) &&
      (!hideCompletedTasks || task.status !== "completed") &&
      (taskSubjectFilter === "全部学科" || task.category === taskSubjectFilter) &&
      (taskTypeFilter === "全部类别" || task.assignmentType === taskTypeFilter) &&
      (taskStatusFilter === "全部状态" || task.status === taskStatusFilter),
  );
  const selectedDateCompleted = filteredTasks.filter((task) => task.status === "completed").length;
  const filteredExams = state.exams.filter(
    (exam) =>
      (examSubjectFilter === "全部学科" || exam.subject === examSubjectFilter) &&
      (examTypeFilter === "全部类别" || exam.examType === examTypeFilter) &&
      (examGradeFilter === "全部年级" || exam.grade === examGradeFilter) &&
      (examSemesterFilter === "全部学期" || exam.semester === examSemesterFilter),
  );
  const weekDays = getWeekDays(selectedTaskDate);

  const scoreTrend = useMemo(() => buildSubjectScoreTrend(state.exams, visibleSubjects), [state.exams, visibleSubjects]);

  const statsWindow = useMemo(() => getStatsWindow(statsDate, statsRange), [statsDate, statsRange]);
  const statsTasks = useMemo(() => state.tasks.filter((task) => task.startDate >= statsWindow.start && task.startDate <= statsWindow.end), [state.tasks, statsWindow]);
  const dailyTimeStats = useMemo(() => {
    const map = new Map<string, { label: string; date: string; minutes: number; planned: number; completed: number; total: number }>();
    for (const day of getDateRange(statsWindow.start, statsWindow.end)) {
      map.set(day, { label: day.slice(5), date: day, minutes: 0, planned: 0, completed: 0, total: 0 });
    }
    for (const task of statsTasks) {
      const item = map.get(task.startDate);
      if (!item) continue;
      item.minutes += task.actualMinutes ?? 0;
      item.planned += task.plannedMinutes ?? 0;
      item.total += 1;
      if (task.status === "completed") item.completed += 1;
    }
    return [...map.values()];
  }, [statsTasks, statsWindow]);
  const subjectTimeStats = useMemo(() => {
    const map = new Map<string, { label: string; date: string; subject: string; minutes: number; planned: number; completed: number; total: number }>();
    for (const task of statsTasks) {
      const item = map.get(task.category) ?? { label: task.category, date: statsDate, subject: task.category, minutes: 0, planned: 0, completed: 0, total: 0 };
      item.minutes += task.actualMinutes ?? 0;
      item.planned += task.plannedMinutes ?? 0;
      item.total += 1;
      if (task.status === "completed") item.completed += 1;
      map.set(task.category, item);
    }
    return [...map.values()];
  }, [statsTasks]);
  const timeComparisonStats = statsRange === "day" ? subjectTimeStats : dailyTimeStats;
  const timeComparisonTitle = statsRange === "day" ? "各学科计划用时 / 实际用时" : "每日计划用时 / 实际用时";
  const completionTitle = statsRange === "day" ? "各学科完成任务" : "每日完成任务";
  const statsSummary = useMemo(
    () => dailyTimeStats.reduce((sum, item) => ({ planned: sum.planned + item.planned, minutes: sum.minutes + item.minutes, completed: sum.completed + item.completed, total: sum.total + item.total }), { planned: 0, minutes: 0, completed: 0, total: 0 }),
    [dailyTimeStats],
  );

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of statsTasks) {
      map.set(task.category, (map.get(task.category) ?? 0) + (task.actualMinutes ?? 0));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [statsTasks]);

  const addTask = async () => {
    if (!taskDraft.title.trim()) return;
    const task = { ...taskDraft, id: editingTaskId ?? crypto.randomUUID(), title: taskDraft.title.trim(), createdAt: editingTaskId ? state.tasks.find((item) => item.id === editingTaskId)?.createdAt ?? nowIso() : nowIso() };
    if (editingTaskId) await updateCloudTask(familyCode, editingTaskId, task);
    else await addCloudTask(familyCode, task);
    setTaskDraft(emptyTask());
    setEditingTaskId(null);
    await load();
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

  const deleteTask = async (id: string) => {
    await deleteCloudTask(familyCode, id);
    await load();
  };

  const editTask = (task: Task) => {
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
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setTaskDraft(emptyTask());
  };

  const startTask = async (task: Task) => {
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
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "任务开始失败");
    } finally {
      setBusyTaskId(null);
    }
  };

  const pauseTask = async (task: Task) => {
    setBusyTaskId(task.id);
    try {
      const elapsed = task.status === "running" && task.startTime ? Math.max(1, Math.round((Date.now() - new Date(task.startTime).getTime()) / 60000)) : 0;
      const actualMinutes = (task.actualMinutes ?? 0) + elapsed;
      await updateCloudTask(familyCode, task.id, { status: "paused", startTime: "", actualMinutes });
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
      const startedAt = task.startTime ? new Date(task.startTime).getTime() : Date.now();
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const actualMinutes = task.status === "running" ? (task.actualMinutes ?? 0) + elapsed : (task.actualMinutes ?? 0);
      const points = task.autoComplete ? (isTaskOverdue(task) ? task.overduePoints : task.rewardPoints) : 0;
      await updateCloudTask(familyCode, task.id, { status: "completed", endTime: nowIso(), actualMinutes });
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
    if (!examDraft.examName.trim()) return;
    const exam = { ...examDraft, id: editingExamId ?? crypto.randomUUID(), examName: examDraft.examName.trim(), rewardPoints: 0 };
    if (editingExamId) await updateCloudExam(familyCode, exam);
    else await addCloudExam(familyCode, exam);
    setExamDraft({ ...examDraft, examName: "" });
    setEditingExamId(null);
    await load();
  };

  const editExam = (exam: ExamRecord) => {
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
      const drafts = await recognizeHomeworkWithBaidu(file, ocrConfig);
      setOcrDrafts(drafts);
      setOcrStatus(drafts.length > 0 ? `识别到 ${drafts.length} 条内容，请确认后添加。` : "没有识别到可用文字。");
    } catch (error) {
      setOcrStatus(error instanceof Error ? error.message : "OCR 识别失败");
    } finally {
      setIsRecognizing(false);
    }
  };

  const parseManualText = () => {
    const drafts = parseHomeworkText(ocrText);
    setOcrDrafts(drafts);
    setOcrStatus(drafts.length > 0 ? `拆解出 ${drafts.length} 条任务，请确认后添加。` : "没有拆解出可用任务。");
  };

  const addOcrDraft = async (draft: OcrDraftTask) => {
    await addCloudTask(familyCode, {
      ...emptyTask(),
      id: crypto.randomUUID(),
      category: draft.category,
      title: draft.title,
      description: draft.description,
      plannedMinutes: draft.plannedMinutes ?? 25,
      rewardPoints: 1,
      createdAt: nowIso(),
    });
    setOcrDrafts((items) => items.filter((item) => item !== draft));
    await load();
  };

  const updateOcrDraft = (index: number, changes: Partial<OcrDraftTask>) => {
    setOcrDrafts((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...changes } : item)));
  };

  if (!userRole) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8ff] p-4 text-slate-900">
        <section className="w-full max-w-xl rounded-[30px] bg-white p-6 shadow-soft">
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
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8ff] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-4 xl:flex-row xl:px-6">
        <aside className="rounded-[28px] bg-white p-3 shadow-soft xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:w-56">
          <div className="mb-4 flex items-center gap-3 px-3 py-2">
            <div className="grid size-12 place-items-center rounded-2xl bg-blue-600 text-white">
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
                  key={tab.id}
                  className={`nav-button ${activeTab === tab.id ? "nav-button-active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={22} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <button className="mt-3 w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-600" onClick={switchRole}>
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
                  <ChartBox>
                    <ResponsiveContainer>
                      <AreaChart data={scoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        {visibleSubjects.map((subject) => (
                          <Area
                            dataKey={subject.name}
                            fill={subject.color}
                            fillOpacity={0.12}
                            key={subject.id}
                            stroke={subject.color}
                            type="monotone"
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartBox>
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
              <Panel title={editingTaskId ? "设置作业" : "添加任务"}>
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
                  <input className="input" placeholder="例如：数学口算 20 题" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} />
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
                  <button className={`reward-toggle ${taskDraft.autoComplete ? "reward-toggle-on" : ""}`} onClick={() => setTaskDraft({ ...taskDraft, autoComplete: !taskDraft.autoComplete })}>
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
                    {["日", "一", "二", "三", "四", "五", "六"].map((day, index) => {
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
                        <div className="ocr-row" key={`${draft.title}-${index}`}>
                          <div className="grid flex-1 gap-2 md:grid-cols-[120px_1fr_110px]">
                            <select className="input" value={draft.category} onChange={(event) => updateOcrDraft(index, { category: event.target.value })}>
                              {subjects.map((subject) => (
                                <option key={subject.id}>{subject.name}</option>
                              ))}
                            </select>
                            <input className="input" value={draft.title} onChange={(event) => updateOcrDraft(index, { title: event.target.value })} />
                            <NumberInput value={draft.plannedMinutes ?? 25} suffix="分钟" onChange={(value) => updateOcrDraft(index, { plannedMinutes: value })} />
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
                <div className="mt-3 grid gap-3 md:grid-cols-3">
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
                      </div>
                      <h3 className="mt-3 text-2xl font-black">{task.title}</h3>
                      <p className="mt-2 text-slate-600">
                        计划 {task.plannedMinutes ?? 0} 分钟 · 已学 {getTaskElapsedMinutes(task)} 分钟
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
                      <button className="secondary-button" onClick={() => editTask(task)}>
                        设置
                      </button>
                      <button className="icon-button" onClick={() => deleteTask(task.id)} aria-label="删除任务">
                        <Trash2 size={20} />
                      </button>
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
                  <NumberInput className="exam-field-small" value={examDraft.score} onChange={(value) => setExamDraft({ ...examDraft, score: value })} />
                  <NumberInput className="exam-field-small" value={examDraft.totalScore} onChange={(value) => setExamDraft({ ...examDraft, totalScore: value })} />
                  <NumberInput className="exam-field-medium" value={examDraft.classRank} suffix="班级名次" onChange={(value) => setExamDraft({ ...examDraft, classRank: value })} />
                  <input className="input exam-date-input" type="date" value={examDraft.examDate} onChange={(event) => setExamDraft({ ...examDraft, examDate: event.target.value })} />
                  <button className="primary-button exam-save-button" onClick={addExam}>
                    <Save size={20} /> {editingExamId ? "更新" : "保存"}
                  </button>
                </div>
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
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title={timeComparisonTitle}>
                  <ChartBox>
                    <ResponsiveContainer>
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
                    <ResponsiveContainer>
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
                    <ResponsiveContainer>
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
              <Header title="勋章墙" subtitle="每个好习惯，都值得被看见。" />
              {userRole === "parent" && (
                <Panel title={editingBadgeId ? "修改勋章规则" : "添加勋章规则"}>
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
                  return (
                    <article className={`badge-card ${badge.unlocked ? "badge-unlocked" : ""}`} key={badge.id}>
                      <BadgeIcon size={34} />
                      <h3>{badge.name}</h3>
                      <p>{badge.description}</p>
                      <span>{badge.unlocked ? "已解锁" : `${getBadgeConditionLabel(badge.conditionType)}：${badge.conditionValue}`}</span>
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
                  {state.ledger.slice(0, userRole === "parent" ? 20 : 8).map((row) => (
                    <div className="ledger-row" key={row.id}>
                      <span>{row.reason}</span>
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
                    await startTask(focusTask);
                    setFocusTask({ ...focusTask, status: "running", startTime: nowIso() });
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
    <header className="rounded-[30px] bg-white p-5 shadow-soft">
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
    <section className="rounded-[28px] bg-white p-5 shadow-soft">
      <h2 className="mb-4 text-2xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function ChartBox({ children }: { children: React.ReactNode }) {
  return <div className="h-72 w-full">{children}</div>;
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

function getTaskElapsedMinutes(task: Task) {
  if (task.status === "running" && task.startTime) {
    return (task.actualMinutes ?? 0) + Math.max(1, Math.round((Date.now() - new Date(task.startTime).getTime()) / 60000));
  }
  return task.actualMinutes ?? 0;
}

function taskOverlapsDate(task: Task, date: string) {
  const endDate = task.endDate || task.startDate;
  return task.startDate <= date && date <= endDate;
}

function isTaskOverdue(task: Task) {
  return (task.endDate || task.startDate) < today();
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

function buildSubjectScoreTrend(exams: ExamRecord[], subjects: Subject[]) {
  const subjectNames = new Set(subjects.map((subject) => subject.name));
  const rows = new Map<string, Record<string, string | number>>();
  for (const exam of exams) {
    if (!subjectNames.has(exam.subject)) continue;
    const key = exam.examDate;
    const row = rows.get(key) ?? { name: exam.examDate.slice(5) };
    row[exam.subject] = Math.round((exam.score / exam.totalScore) * 100);
    rows.set(key, row);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([, value]) => value);
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
