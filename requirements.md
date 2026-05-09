# 小学生学习计划与打卡统计助手

## 1. 项目简介

这是一个面向小学生家庭场景的 Web 应用。

目标是帮助孩子：

- 记录每日作业
- 管理学习计划
- 统计学习时间
- 获得积分与奖励
- 培养学习习惯

系统采用：

- 本地优先（Local First）
- 无后端
- GitHub Pages 部署
- 浏览器本地数据库（IndexedDB）

项目仅供家庭内部使用，不考虑复杂权限系统，只需要家长账户认证即可。

---

# 2. 产品目标

本项目的核心不是“任务管理”。

而是：

- 降低孩子记录作业的门槛
- 提高孩子完成任务的积极性
- 用游戏化方式培养习惯
- 让家长可以直观看到学习成长

---

# 3. 技术要求

## 技术栈

### 前端

- React
- TypeScript
- Vite

### UI

- TailwindCSS
- shadcn/ui

### 图表

- Recharts

### 本地数据库

- IndexedDB
- Dexie.js

### 部署

- GitHub Pages

---

# 4. 核心设计原则

## 4.1 Local First

所有数据默认保存在浏览器本地。

不依赖：

- PostgreSQL
- 后端 API
- 云数据库

必须支持：

- JSON 导出
- JSON 导入
- 本地备份恢复

---

## 4.2 儿童友好

界面必须：

- 大按钮
- 大字体
- 高对比度
- 少输入
- 少层级
- 卡片化
- 手机、IPAD、PC浏览器多端UI支持

避免：

- 复杂表格
- 密集文字
- 管理后台风格

---

## 4.3 游戏化

系统需要强化：

- 成就感
- 反馈感
- 奖励机制

包括：

- 勋章
- 连续打卡
- 积分
- 奖励兑换
- 完成动画

---

# 5. 页面结构

## 首页 Dashboard

显示：

- 今日学习时间
- 今日任务数量
- 今日完成率
- 当前积分
- 最近成绩趋势
- 最近勋章

采用：

- 卡片式布局
- 大数字
- 图标化设计

---

## 学习计划页

功能：

- 查看当天任务
- 添加任务
- 编辑任务
- 完成任务
- 开始计时

每个任务卡片包含：

- 科目分类
- 标题
- 描述
- 计划时间
- 实际耗时
- 完成状态
- 积分变化

---

## 成绩记录页

功能：

- 添加考试成绩
- 查看成绩列表
- 查看成绩趋势

字段：

- 科目
- 考试名称
- 日期
- 得分
- 满分
- 平均分
- 排名（可选）

---

## 学习统计页

包含图表：

- 每日学习时间
- 每日完成率
- 分类时间占比
- 计划时间 vs 实际时间
- 连续打卡趋势

---

## 勋章墙页面

展示：

- 已获得勋章
- 未解锁勋章
- 解锁条件

勋章分类：

- 学习时间
- 连续打卡
- 任务数量
- 单日挑战
- 成绩达成

---

## 积分奖励页

功能：

- 查看积分
- 查看奖励列表
- 兑换奖励
- 查看积分流水

奖励示例：

- 玩具
- 动物园
- 看动画
- 零食
- 安静书

---

# 6. 数据模型

## 学习任务 Task

```ts
type Task = {
  id: string

  category: string

  title: string

  description?: string

  plannedMinutes?: number

  actualMinutes?: number

  startTime?: string

  endTime?: string

  status:
    | "pending"
    | "running"
    | "completed"
    | "expired"

  repeatType:
    | "none"
    | "daily"
    | "weekly"

  repeatDays?: number[]

  startDate: string

  endDate?: string

  autoComplete: boolean

  rewardPoints: number

  penaltyPoints: number

  overduePoints: number

  createdAt: string
}
```

---

## 成绩 ExamRecord

```ts
type ExamRecord = {
  id: string

  subject: string

  examName: string

  score: number

  totalScore: number

  averageScore?: number

  classRank?: number

  gradeRank?: number

  examDate: string
}
```

---

## 勋章 Badge

```ts
type Badge = {
  id: string

  name: string

  description: string

  icon: string

  unlocked: boolean

  unlockedAt?: string

  conditionType: string

  conditionValue: number
}
```

---

## 奖励 Reward

```ts
type Reward = {
  id: string

  title: string

  description?: string

  pointsCost: number

  icon?: string

  enabled: boolean
}
```

---

# 7. 必须实现功能

## P0（第一版必须完成）

### 基础功能

- [ ] 学习任务 CRUD
- [ ] 任务计时
- [ ] 完成状态管理
- [ ] 积分系统
- [ ] 奖励兑换
- [ ] 勋章解锁
- [ ] 学习统计图表
- [ ] 成绩记录
- [ ] IndexedDB 数据持久化
- [ ] JSON 导入导出
- [ ] GitHub Pages 部署

---

# 8. 第二阶段功能

## P1

- [ ] OCR 作业识别
- [ ] AI 自动生成任务
- [ ] 语音输入
- [ ] PWA
- [ ] 推送提醒
- [ ] 学习专注模式
- [ ] 动画反馈

---

# 9. UI 风格要求

风格：

- 儿童教育产品
- 游戏化
- 清爽
- 圆角
- 卡片式

主色：

- 蓝色
- 紫色
- 黄色
- 绿色

避免：

- 企业后台风格
- 深色主题
- 复杂菜单

---

# 10. 响应式要求

必须支持：

- iPad
- 手机横屏
- 桌面浏览器

优先：

- iPad 使用体验

---

# 11. 数据备份要求

必须支持：

## 导出

导出：

```json
{
  "tasks": [],
  "exams": [],
  "badges": [],
  "rewards": [],
  "settings": []
}
```

---

## 导入

支持：

- JSON 文件恢复
- 覆盖导入
- 合并导入

---

# 12. 非目标（当前不做）

以下内容不在第一阶段范围：

- 用户登录
- 多孩子系统
- 后端服务
- PostgreSQL
- 云同步
- 家长审批
- 社交系统
- 排行榜
- 多人协作

---

# 13. 开发要求

代码要求：

- TypeScript 严格模式
- 组件化
- 可维护
- 避免过度抽象

推荐目录：

```text
src/
  components/
  pages/
  hooks/
  stores/
  db/
  services/
  utils/
  types/
```

---

# 14. Vibe Coding 要求

开发过程中：

- 优先快速迭代
- 先完成功能
- 再优化结构
- 每次改动保持可运行
- 优先可视化结果
- 减少过度设计

AI Agent 生成代码时：

- 优先生成完整可运行功能
- 避免只生成伪代码
- 避免过度拆分文件
- 优先本地状态管理
- 避免引入复杂状态机

---

# 15. 项目目标总结

这是一个：

“部署在 GitHub Pages 上的、面向单个孩子使用的、本地优先的学习计划与打卡统计 Web 应用。”

核心目标：

- 简单
- 有趣
- 易坚持
- 易统计
- 易成长