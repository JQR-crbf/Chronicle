// --- Core Types ---

export type Priority = "Low" | "Medium" | "High";
export type Status = "To Do" | "In Progress" | "Done";
export type SortMode = "default" | "priority" | "date";
export type ViewMode = "board" | "timeline" | "insights";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  tags: string[];
  subtasks: Subtask[];
  dueDate?: string;
  storyPoints?: number;
  // 时间戳字段
  createdAt: string;      // 创建时间 (ISO 8601 格式)
  updatedAt: string;      // 最后更新时间
  completedAt?: string;   // 完成时间 (仅 status 为 'Done' 时有值)
  // AI 语义搜索字段
  embedding?: number[];   // 任务的向量表示（用于语义搜索）
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

// --- Screenpipe Types ---

export interface ScreenpipeEvent {
  id: string;
  timestamp: string; // ISO string
  appName: string;
  windowTitle: string;
  content: string;
  type: 'OCR' | 'Audio' | 'UI';
  confidence?: number;
  aiAnalysis?: AIAnalysis; // AI 分析结果
}

export interface AIAnalysis {
  summary: string;        // 内容摘要
  keywords: string[];     // 关键词
  category: string;       // 分类（工作/娱乐/学习等）
  importance: number;     // 重要性评分 (1-5)
  analyzedAt: string;     // 分析时间
}

// --- RPG Types ---

export interface RPGItem {
  id: string;
  name: string;
  type: 'Head' | 'Body' | 'MainHand' | 'OffHand';
  bonus: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  icon: string;
  desc?: string;
}

export interface RPGSkill {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  description: string;
  icon: string;
}

export interface RPGStats {
  level: number;
  title: string;
  strength: number; // Coding
  charisma: number; // Communication
  wisdom: number;   // Focus
  chaos: number;    // Entertainment
  xp: number;
  nextLevelXp: number;
}

export interface RPGDetails {
  items: RPGItem[];
  skills: RPGSkill[];
}

// --- AI Provider Types ---

export type AIProvider = 'gemini' | 'openrouter';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model?: string; // 可选：自定义模型名称
}

export interface AIClient {
  generateContent: (params: { model: string; contents: any; config?: any }) => Promise<any>;
  generateContentStream?: (params: { model: string; contents: any }) => AsyncGenerator<{ text: string }>;
}
