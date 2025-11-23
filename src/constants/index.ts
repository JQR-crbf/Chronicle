import { Priority, Status, SortMode, Task, ScreenpipeEvent, RPGStats, RPGDetails } from '../types';

// --- Label Mappings ---

export const STATUS_LABELS: Record<Status, string> = {
  "To Do": "待办",
  "In Progress": "进行中",
  "Done": "已完成"
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  "Low": "低",
  "Medium": "中",
  "High": "高"
};

export const SORT_LABELS: Record<SortMode, string> = {
  "default": "默认排序",
  "priority": "优先级 (高→低)",
  "date": "截止日期 (近→远)"
};

// --- Initial Data ---

export const initialTasks: Task[] = [
  {
    id: "t-1",
    title: "设计登录页面 🎨",
    description: "为移动端应用设计一个简洁、现代的登录界面，包含第三方登录选项。色调要温馨。",
    status: "To Do",
    priority: "High",
    tags: ["UI/UX", "Mobile"],
    dueDate: "2023-11-15",
    storyPoints: 5,
    subtasks: [
        { id: "st-1", title: "收集灵感参考", completed: true },
        { id: "st-2", title: "绘制线框图", completed: false }
    ],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2天前
    updatedAt: new Date().toISOString()
  },
  {
    id: "t-2",
    title: "集成 Gemini API 🤖",
    description: "使用 Google Gemini Flash 模型实现文本生成功能。确保响应速度快。",
    status: "In Progress",
    priority: "High",
    tags: ["Dev", "AI"],
    dueDate: "2023-11-10",
    storyPoints: 8,
    subtasks: [],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3天前
    updatedAt: new Date().toISOString()
  },
  {
    id: "t-3",
    title: "编写 README 文档 📝",
    description: "详细说明项目启动流程和环境变量配置。",
    status: "Done",
    priority: "Low",
    tags: ["Docs"],
    storyPoints: 2,
    subtasks: [],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5天前
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1天前更新
    completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1天前完成
  }
];

// --- Mock Data for Timeline & Insights ---

export const mockTimelineEvents: ScreenpipeEvent[] = [
    { id: "e-1", timestamp: "2023-11-12T09:30:00", appName: "Visual Studio Code", windowTitle: "index.tsx - GeminiTask", content: "const ai = new GoogleGenAI...", type: "OCR" },
    { id: "e-2", timestamp: "2023-11-12T09:45:00", appName: "Google Chrome", windowTitle: "Gemini API Docs", content: "generateContentStream is best for...", type: "OCR" },
    { id: "e-3", timestamp: "2023-11-12T10:15:00", appName: "Slack", windowTitle: "#project-sync", content: "Hey, can we update the README?", type: "OCR" },
    { id: "e-4", timestamp: "2023-11-12T11:00:00", appName: "Zoom", windowTitle: "Weekly Sync", content: "Meeting transcript: Discussing Q4 goals...", type: "Audio" },
    { id: "e-5", timestamp: "2023-11-12T13:30:00", appName: "Figma", windowTitle: "Login Screen V2", content: "Frame 1024: Button / Primary", type: "UI" },
];

export const mockRPGStats: RPGStats = {
    level: 12,
    title: "代码魔导师",
    strength: 85, // Coding
    charisma: 40, // Communication
    wisdom: 92,   // Focus
    chaos: 15,    // Entertainment
    xp: 3450,
    nextLevelXp: 5000
};

export const mockRPGDetails: RPGDetails = {
  items: [
    { id: 'i1', name: '降噪耳机', type: 'Head', bonus: '+15 专注度', rarity: 'Epic', icon: '🎧', desc: '隔绝世俗喧嚣，只留心流。' },
    { id: 'i2', name: '格子衬衫', type: 'Body', bonus: '+5 代码力', rarity: 'Common', icon: '👕', desc: '程序员的标准皮肤，增加亲和力。' },
    { id: 'i3', name: 'HHKB 键盘', type: 'MainHand', bonus: '+20 代码力', rarity: 'Legendary', icon: '⌨️', desc: '指尖跳舞，Bug 退散！' },
    { id: 'i4', name: '冰美式', type: 'OffHand', bonus: '+10 精神', rarity: 'Rare', icon: '☕', desc: '续命神水，不可或缺。' },
  ],
  skills: [
    { id: 's1', name: '快速重构', level: 5, maxLevel: 10, description: '重构代码时减少 30% 的 Bug 率', icon: '⚡' },
    { id: 's2', name: '摸鱼', level: 99, maxLevel: 100, description: '看起来在工作，其实在看 V2EX', icon: '🐟' },
    { id: 's3', name: '文档编写', level: 3, maxLevel: 10, description: '写出的文档有时候自己也看不懂', icon: '📝' },
    { id: 's4', name: 'Debug 之眼', level: 8, maxLevel: 10, description: '一眼看穿内存泄漏', icon: '👁️' },
  ]
};

export const mockDailyReport = `
# 📅 日报 (2023-11-12)

### 🚀 开发进度
- **GeminiTask**: 完成了 API 的流式响应集成。
- **Bugfix**: 修复了移动端布局无法滑动的问题。

### 💬 沟通与会议
- 参加了 **Weekly Sync** (11:00 - 12:00)。
- 在 Slack 上确认了 README 文档的更新需求。

### 📚 调研
- 查阅了 Google Gemini API 关于 \`generateContentStream\` 的文档。
`;

export const mockWeeklyReport = `
# 🗓️ 周报 (2023-11-06 ~ 2023-11-12)

### 🌟 本周亮点
- **核心功能**: 完成了 Screenpipe 本地数据流的打通。
- **AI 集成**: 成功调试了 Gemini Flash 模型，响应速度提升 30%。

### 🚧 遇到的挑战
- **性能问题**: 大量 OCR 数据导致前端渲染卡顿，已通过虚拟列表优化。
- **权限**: macOS 屏幕录制权限申请流程较为繁琐。

### 📈 下周计划
- [ ] 完善时间轴组件的交互动画。
- [ ] 设计新的 RPG 角色升级特效。
`;

