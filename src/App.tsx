import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Gift,
  Home,
  Loader2,
  Medal,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Timer,
  Trash2,
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
import { recognizeHomeworkWithBaidu, type OcrDraftTask } from "./ocr";
import {
  addCloudExam,
  addCloudLedger,
  addCloudTask,
  DEFAULT_FAMILY_CODE,
  deleteCloudTask,
  ensureCloudSeedData,
  fetchCloudData,
  getPointBalance,
  refreshCloudBadges,
  restoreCloudBackup,
  updateCloudSettings,
  updateCloudTask,
} from "./supabase";
import type { AppSettings, BackupData, Badge, ExamRecord, PointLedger, Reward, Task } from "./types";

type Tab = "dashboard" | "tasks" | "exams" | "stats" | "badges" | "rewards" | "settings";

type AppState = {
  tasks: Task[];
  exams: ExamRecord[];
  badges: Badge[];
  rewards: Reward[];
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
  { id: "settings", label: "设置", icon: Settings },
];

const categories = ["语文", "数学", "英语", "科学", "阅读", "其他"];
const palette = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#ef4444", "#0d9488"];

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const familyCodeKey = "homework-web-family-code";
const ocrSettingsKey = "homework-web-local-ocr";

function emptyTask(): Omit<Task, "id" | "createdAt"> {
  return {
    category: "数学",
    title: "",
    description: "",
    plannedMinutes: 30,
    actualMinutes: 0,
    status: "pending",
    repeatType: "none",
    startDate: today(),
    autoComplete: false,
    rewardPoints: 10,
    penaltyPoints: 0,
    overduePoints: 0,
  };
}

function App() {
  const [familyCode, setFamilyCode] = useState(() => localStorage.getItem(familyCodeKey) ?? DEFAULT_FAMILY_CODE);
  const [familyCodeDraft, setFamilyCodeDraft] = useState(() => localStorage.getItem(familyCodeKey) ?? DEFAULT_FAMILY_CODE);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [state, setState] = useState<AppState>({
    tasks: [],
    exams: [],
    badges: [],
    rewards: [],
    ledger: [],
    points: 0,
  });
  const [taskDraft, setTaskDraft] = useState(emptyTask());
  const [examDraft, setExamDraft] = useState({
    subject: "数学",
    examName: "",
    score: 95,
    totalScore: 100,
    averageScore: 85,
    examDate: today(),
  });
  const [ocrWarning, setOcrWarning] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrDrafts, setOcrDrafts] = useState<OcrDraftTask[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>({
    id: "default",
    childName: "小朋友",
    baiduOcr: loadLocalOcrSettings(),
  });
  const [cloudStatus, setCloudStatus] = useState("正在连接 Supabase...");
  const [isCloudBusy, setIsCloudBusy] = useState(false);

  const load = async () => {
    setIsCloudBusy(true);
    try {
      await ensureCloudSeedData(familyCode);
      const data = await fetchCloudData(familyCode);
      await refreshCloudBadges(familyCode, data.tasks, data.badges);
      const refreshed = await fetchCloudData(familyCode);
      const settings = refreshed.settings[0] ?? { id: "default", childName: "小朋友" };
      setState({
        tasks: refreshed.tasks,
        exams: refreshed.exams,
        badges: refreshed.badges,
        rewards: refreshed.rewards,
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

  const todayTasks = state.tasks.filter((task) => task.startDate === today());
  const completedToday = todayTasks.filter((task) => task.status === "completed");
  const studyMinutesToday = todayTasks.reduce((sum, task) => sum + (task.actualMinutes ?? 0), 0);
  const completionRate = todayTasks.length === 0 ? 0 : Math.round((completedToday.length / todayTasks.length) * 100);

  const scoreTrend = useMemo(
    () =>
      [...state.exams]
        .reverse()
        .slice(-8)
        .map((exam) => ({
          name: exam.examDate.slice(5),
          score: Math.round((exam.score / exam.totalScore) * 100),
          subject: exam.subject,
        })),
    [state.exams],
  );

  const dailyStats = useMemo(() => {
    const map = new Map<string, { date: string; minutes: number; completed: number; total: number }>();
    for (const task of state.tasks) {
      const item = map.get(task.startDate) ?? { date: task.startDate.slice(5), minutes: 0, completed: 0, total: 0 };
      item.minutes += task.actualMinutes ?? 0;
      item.total += 1;
      if (task.status === "completed") item.completed += 1;
      map.set(task.startDate, item);
    }
    return [...map.values()].slice(-10);
  }, [state.tasks]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of state.tasks) {
      map.set(task.category, (map.get(task.category) ?? 0) + (task.actualMinutes ?? 0));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [state.tasks]);

  const addTask = async () => {
    if (!taskDraft.title.trim()) return;
    await addCloudTask(familyCode, { ...taskDraft, id: crypto.randomUUID(), title: taskDraft.title.trim(), createdAt: nowIso() });
    setTaskDraft(emptyTask());
    await load();
  };

  const deleteTask = async (id: string) => {
    await deleteCloudTask(familyCode, id);
    await load();
  };

  const startTask = async (task: Task) => {
    await updateCloudTask(familyCode, task.id, { status: "running", startTime: nowIso() });
    await load();
  };

  const completeTask = async (task: Task) => {
    const startedAt = task.startTime ? new Date(task.startTime).getTime() : Date.now();
    const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const actualMinutes = Math.max(task.actualMinutes ?? 0, task.status === "running" ? elapsed : task.actualMinutes ?? task.plannedMinutes ?? 1);
    await updateCloudTask(familyCode, task.id, { status: "completed", endTime: nowIso(), actualMinutes });
    await addCloudLedger(familyCode, "earn", task.rewardPoints, `完成任务：${task.title}`);
    await load();
  };

  const addExam = async () => {
    if (!examDraft.examName.trim()) return;
    await addCloudExam(familyCode, { ...examDraft, id: crypto.randomUUID(), examName: examDraft.examName.trim() });
    setExamDraft({ ...examDraft, examName: "" });
    await load();
  };

  const redeemReward = async (reward: Reward) => {
    if (state.points < reward.pointsCost) return;
    await addCloudLedger(familyCode, "spend", -reward.pointsCost, `兑换奖励：${reward.title}`);
    await load();
  };

  const downloadBackup = async () => {
    const backup: BackupData = {
      tasks: state.tasks,
      exams: state.exams,
      badges: state.badges,
      rewards: state.rewards,
      settings: state.settings ? [{ id: state.settings.id, childName: state.settings.childName }] : [],
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
    await updateCloudSettings(familyCode, settingsDraft);
    localStorage.setItem(ocrSettingsKey, JSON.stringify(settingsDraft.baiduOcr ?? { mode: "local", apiKey: "", secretKey: "" }));
    setOcrWarning("孩子昵称已保存到 Supabase。OCR 密钥只保存在当前浏览器。");
    await load();
  };

  const saveFamilyCode = async () => {
    const nextCode = familyCodeDraft.trim();
    if (!nextCode) return;
    localStorage.setItem(familyCodeKey, nextCode);
    setFamilyCode(nextCode);
  };

  const recognizeImage = async (file: File) => {
    const config = state.settings?.baiduOcr;
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
        : { mode: "proxy" as const, proxyUrl: config.proxyUrl ?? "" };

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

  const addOcrDraft = async (draft: OcrDraftTask) => {
    await addCloudTask(familyCode, {
      ...emptyTask(),
      id: crypto.randomUUID(),
      category: draft.category,
      title: draft.title,
      description: draft.description,
      createdAt: nowIso(),
    });
    setOcrDrafts((items) => items.filter((item) => item !== draft));
    await load();
  };

  return (
    <main className="min-h-screen bg-[#f6f8ff] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="rounded-[28px] bg-white p-3 shadow-soft lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-56">
          <div className="mb-4 flex items-center gap-3 px-3 py-2">
            <div className="grid size-12 place-items-center rounded-2xl bg-blue-600 text-white">
              <Sparkles />
            </div>
            <div>
              <p className="text-sm text-slate-500">学习打卡</p>
              <h1 className="text-xl font-black">成长星球</h1>
            </div>
          </div>
          <nav className="grid grid-cols-4 gap-2 lg:grid-cols-1">
            {tabs.map((tab) => {
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
                        <Area type="monotone" dataKey="score" stroke="#2563eb" fill="#bfdbfe" />
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
              <Panel title="添加任务">
                <div className="grid gap-3 lg:grid-cols-[140px_1fr_120px_120px_120px]">
                  <select className="input" value={taskDraft.category} onChange={(event) => setTaskDraft({ ...taskDraft, category: event.target.value })}>
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <input className="input" placeholder="例如：数学口算 20 题" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} />
                  <NumberInput value={taskDraft.plannedMinutes ?? 0} suffix="分钟" onChange={(value) => setTaskDraft({ ...taskDraft, plannedMinutes: value })} />
                  <NumberInput value={taskDraft.rewardPoints} suffix="积分" onChange={(value) => setTaskDraft({ ...taskDraft, rewardPoints: value })} />
                  <button className="primary-button" onClick={addTask}>
                    <Plus size={20} /> 添加
                  </button>
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
                  {ocrDrafts.length > 0 && (
                    <div className="grid gap-3">
                      {ocrDrafts.map((draft, index) => (
                        <div className="ocr-row" key={`${draft.title}-${index}`}>
                          <div>
                            <span className="pill">{draft.category}</span>
                            <p className="mt-2 text-lg font-black">{draft.title}</p>
                          </div>
                          <button className="primary-button" onClick={() => addOcrDraft(draft)}>
                            <Plus size={20} /> 添加
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
              <div className="grid gap-4 xl:grid-cols-2">
                {state.tasks.map((task) => (
                  <article className={`task-card ${task.status === "completed" ? "task-done" : ""}`} key={task.id}>
                    <div>
                      <span className="pill">{task.category}</span>
                      <h3 className="mt-3 text-2xl font-black">{task.title}</h3>
                      <p className="mt-2 text-slate-600">计划 {task.plannedMinutes ?? 0} 分钟 · 已学 {task.actualMinutes ?? 0} 分钟 · 奖励 {task.rewardPoints} 分</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {task.status !== "completed" && (
                        <>
                          <button className="secondary-button" onClick={() => startTask(task)}>
                            <Clock size={20} /> 开始
                          </button>
                          <button className="success-button" onClick={() => completeTask(task)}>
                            <CheckCircle2 size={20} /> 完成
                          </button>
                        </>
                      )}
                      <button className="icon-button" onClick={() => deleteTask(task.id)} aria-label="删除任务">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === "exams" && (
            <div className="space-y-5">
              <Header title="成绩记录" subtitle="记录考试，也看见一点点进步。" />
              <Panel title="添加成绩">
                <div className="grid gap-3 lg:grid-cols-[140px_1fr_120px_120px_120px_120px]">
                  <select className="input" value={examDraft.subject} onChange={(event) => setExamDraft({ ...examDraft, subject: event.target.value })}>
                    {categories.slice(0, 4).map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <input className="input" placeholder="考试名称" value={examDraft.examName} onChange={(event) => setExamDraft({ ...examDraft, examName: event.target.value })} />
                  <NumberInput value={examDraft.score} onChange={(value) => setExamDraft({ ...examDraft, score: value })} />
                  <NumberInput value={examDraft.totalScore} onChange={(value) => setExamDraft({ ...examDraft, totalScore: value })} />
                  <input className="input" type="date" value={examDraft.examDate} onChange={(event) => setExamDraft({ ...examDraft, examDate: event.target.value })} />
                  <button className="primary-button" onClick={addExam}>
                    <Save size={20} /> 保存
                  </button>
                </div>
              </Panel>
              <div className="grid gap-3">
                {state.exams.map((exam) => (
                  <article className="row-card" key={exam.id}>
                    <div>
                      <span className="pill">{exam.subject}</span>
                      <h3 className="mt-2 text-xl font-black">{exam.examName}</h3>
                      <p className="text-slate-500">{exam.examDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-blue-600">{exam.score}</p>
                      <p className="text-sm text-slate-500">满分 {exam.totalScore}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="space-y-5">
              <Header title="学习统计" subtitle="用图表看见时间、完成率和科目分布。" />
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title="每日学习时间">
                  <ChartBox>
                    <ResponsiveContainer>
                      <BarChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="minutes" fill="#16a34a" radius={[10, 10, 0, 0]} />
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
                            <Cell key={entry.name} fill={palette[index % palette.length]} />
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {state.badges.map((badge) => (
                  <article className={`badge-card ${badge.unlocked ? "badge-unlocked" : ""}`} key={badge.id}>
                    <Medal size={34} />
                    <h3>{badge.name}</h3>
                    <p>{badge.description}</p>
                    <span>{badge.unlocked ? "已解锁" : `目标：${badge.conditionValue}`}</span>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === "rewards" && (
            <div className="space-y-5">
              <Header title="积分奖励" subtitle={`当前有 ${state.points} 积分，可以兑换喜欢的小奖励。`} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {state.rewards.map((reward) => (
                  <article className="reward-card" key={reward.id}>
                    <Gift size={32} />
                    <h3>{reward.title}</h3>
                    <p>{reward.description ?? "完成学习任务后兑换"}</p>
                    <button className="primary-button" disabled={state.points < reward.pointsCost} onClick={() => redeemReward(reward)}>
                      {reward.pointsCost} 分兑换
                    </button>
                  </article>
                ))}
              </div>
              <Panel title="积分流水">
                <div className="grid gap-2">
                  {state.ledger.slice(0, 8).map((row) => (
                    <div className="ledger-row" key={row.id}>
                      <span>{row.reason}</span>
                      <strong className={row.points >= 0 ? "text-green-600" : "text-red-500"}>{row.points > 0 ? `+${row.points}` : row.points}</strong>
                    </div>
                  ))}
                </div>
              </Panel>
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
                    GitHub Pages 纯前端无法安全保护 Secret Key。这里的配置只保存在当前浏览器，用于家庭自用；更推荐使用代理接口模式。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={settingsDraft.baiduOcr?.mode === "local" ? "primary-button" : "secondary-button"}
                      onClick={() => setSettingsDraft({ ...settingsDraft, baiduOcr: { mode: "local", apiKey: "", secretKey: "" } })}
                    >
                      本地密钥
                    </button>
                    <button
                      className={settingsDraft.baiduOcr?.mode === "proxy" ? "primary-button" : "secondary-button"}
                      onClick={() => setSettingsDraft({ ...settingsDraft, baiduOcr: { mode: "proxy", proxyUrl: "" } })}
                    >
                      代理接口
                    </button>
                  </div>
                  {settingsDraft.baiduOcr?.mode === "local" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        className="input"
                        placeholder="百度云 API Key"
                        value={settingsDraft.baiduOcr.apiKey ?? ""}
                        onChange={(event) =>
                          setSettingsDraft({ ...settingsDraft, baiduOcr: { mode: "local", apiKey: event.target.value, secretKey: settingsDraft.baiduOcr?.secretKey ?? "" } })
                        }
                      />
                      <input
                        className="input"
                        placeholder="百度云 Secret Key"
                        type="password"
                        value={settingsDraft.baiduOcr.secretKey ?? ""}
                        onChange={(event) =>
                          setSettingsDraft({ ...settingsDraft, baiduOcr: { mode: "local", apiKey: settingsDraft.baiduOcr?.apiKey ?? "", secretKey: event.target.value } })
                        }
                      />
                    </div>
                  ) : (
                    <input
                      className="input w-full"
                      placeholder="https://你的域名/ocr-proxy"
                      value={settingsDraft.baiduOcr?.proxyUrl ?? ""}
                      onChange={(event) => setSettingsDraft({ ...settingsDraft, baiduOcr: { mode: "proxy", proxyUrl: event.target.value } })}
                    />
                  )}
                  <button className="primary-button" onClick={saveSettings}>
                    <Save size={20} /> 保存 OCR 配置
                  </button>
                  {ocrWarning && <p className="rounded-2xl bg-blue-50 p-4 text-blue-900">{ocrWarning}</p>}
                </div>
              </Panel>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="rounded-[30px] bg-white p-5 shadow-soft">
      <p className="font-bold text-blue-600">Supabase · 家庭同步码</p>
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

function NumberInput({ value, onChange, suffix }: { value: number; onChange: (value: number) => void; suffix?: string }) {
  return (
    <label className="input flex items-center gap-2">
      <input className="w-full bg-transparent outline-none" type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      {suffix && <span className="shrink-0 text-sm text-slate-500">{suffix}</span>}
    </label>
  );
}

function loadLocalOcrSettings(): AppSettings["baiduOcr"] {
  try {
    const raw = localStorage.getItem(ocrSettingsKey);
    if (!raw) return { mode: "local", apiKey: "", secretKey: "" };
    return JSON.parse(raw) as AppSettings["baiduOcr"];
  } catch {
    return { mode: "local", apiKey: "", secretKey: "" };
  }
}

export default App;
