import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { invoke } from '@tauri-apps/api/core';
import { mockDailyReport, mockWeeklyReport } from '../constants';
import { EyeIcon, FileTextIcon, ChartPieIcon, CopyIcon, SparklesIcon, ClockIcon, CalendarIcon } from '../components/icons';
import { getEventsByDateRange } from '../utils/screenpipe';
import { 
    analyzeTodayEvents, 
    calculateRPGStats, 
    getWeekEvents
} from '../utils/insightsAnalyzer';
import { analyzeTaskStats, convertToChartHeights } from '../utils/taskAnalyzer';
import { storage } from '../utils/storage';
import { filterEvents, type FilterStrategy } from '../utils/reportFilters';
import { ReportSettingsModal, type ReportSettings } from '../components/modals/ReportSettingsModal';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { PatInputModal } from '../components/modals/PatInputModal';
import { PromptEditorModal } from '../components/modals/PromptEditorModal';
import { saveReport, getReport, saveDailyStats, getDailyStats, migrateReportsFromLocalStorage } from '../utils/database';
import type { TodayOverview, TimeDistribution, AppUsage, FocusPeriod, RPGStats } from '../utils/insightsAnalyzer';
import type { TaskStats } from '../utils/taskAnalyzer';
import type { ScreenpipeEvent, AIClient } from '../types';

interface InsightsViewProps {
  onOpenRPGDetail: () => void;
  ai: AIClient | null;
  modelName: string;
}

// ==================== 默认提示词定义 ====================

const DEFAULT_PROMPTS = {
  daily_detailed: `你是一名资深的工作效率顾问和技术文档专家，负责为高级工程师编写专业、详实的工作日报。

## 任务要求

根据以下数据为 {date} 生成一份**详细、专业、数据驱动**的工作日报。

## 日报格式要求

### 结构（使用 Markdown）

\`\`\`markdown
# 📅 工作日报 - {date}

## 📊 工作概览
- **总工作时长**：X.X 小时
- **深度工作时长**：X.X 小时
- **专注度评分**：XX/100
- **完成任务**：X 个

## 🚀 核心工作内容

### 1. [项目/模块名称]
**工作内容：**
- 详细描述具体完成的工作（至少3-5条）
- 包含技术细节和实现方式
- 注明完成时间段

**技术亮点：**
- 使用的关键技术或工具
- 解决的技术难点

**产出成果：**
- 具体的交付物或成果

### 2. [项目/模块名称]（如有多个项目）
（同上格式）

## 💬 沟通与协作

### 会议记录
- **[时间段]** [会议主题] - 讨论要点、决策事项

### 技术交流
- 具体的沟通内容和解决的问题

## 📚 学习与调研

### 技术调研
- 调研的技术点或问题
- 查阅的文档和资料
- 得出的结论或方案

### 知识积累
- 学习到的新知识或技能

## 📈 数据分析

### 效率分析
- 深度工作占比达到 X%，说明...
- 专注度评分 XX 分，表明...
- 工具使用情况分析...

### 时间分布
- 上午/下午的工作重点
- 高效时段分析

## ⚡ 今日亮点
1. 最重要的成果或突破
2. 值得记录的技术实践
3. 高效的工作方法

## 📝 明日计划
1. 待完成的重点任务
2. 需要跟进的事项
3. 计划调研的技术点

---
*报告生成时间：${new Date().toLocaleString('zh-CN')}*
\`\`\`

## 内容要求

1. **详细度**：
   - 每个工作项至少写 3-5 条具体内容
   - 总字数 800-1200 字
   - 包含具体的时间、数据、工具名称

2. **专业性**：
   - 使用准确的技术术语
   - 体现工程师的技术深度
   - 数据驱动的分析

3. **结构化**：
   - 清晰的层级结构
   - 合理的分类归纳
   - 逻辑连贯

4. **智能过滤**：
   - 自动过滤娱乐、摸鱼内容
   - 只保留工作相关的活动
   - 合理归类和总结

5. **数据呈现**：
   - 充分利用统计数据
   - 用数据支撑结论
   - 量化工作成果

6. **实用价值**：
   - 可作为工作记录
   - 便于团队汇报
   - 方便日后回顾

## 注意事项

- 从活动日志中**智能提取**工作内容，不要简单罗列
- **推理项目名称**和模块名称（基于窗口标题和活动内容）
- **归纳总结**而非流水账
- 即使数据不完整，也要生成完整的日报结构
- 专业、客观、数据驱动`,

  daily_leader: `根据用户 {date} 的工作记录，生成一份结构化的工作日报。

## 要求

1. 使用 Markdown 格式
2. 包含以下部分：
   - 📅 日报 ({date})
   - 🚀 开发进度
   - 💬 沟通与会议
   - 📚 调研
3. 过滤掉娱乐和摸鱼内容
4. 突出重要成果和数据
5. 语言专业
6. 一共 800 字左右
7. 不要包含具体时间信息`,

  weekly_from_daily: `你是一个专业的工作周报生成助手。

根据用户本周每天的日报，生成一份结构化的工作周报。

要求：
1. 使用 Markdown 格式
2. 包含以下部分：
   - 🗓️ 周报 ({weekStart} ~ {weekEnd})
   - 🌟 本周亮点（综合本周最重要的成果）
   - 📊 数据统计（如果日报中有数据，进行汇总）
   - 🚧 改进建议（基于每天的工作情况提出改进方向）
   - 📈 下周计划（基于本周工作进展提出合理计划）
3. 汇总提炼，不要简单复制日报内容
4. 突出重点和趋势
5. 语言简洁专业
6. 全文 1200-1500 字

本周日报内容：
{dailyReportsText}`,

  weekly_from_raw: `你是一个专业的工作周报生成助手。

根据用户本周的屏幕活动数据，生成一份结构化的工作周报。

要求：
1. 使用 Markdown 格式
2. 包含以下部分：
   - 🗓️ 周报 ({weekStart} ~ {weekEnd})
   - 🌟 本周亮点
   - 📊 数据统计
   - 🚧 改进建议
   - 📈 下周计划
3. 基于数据提供洞察，而不是简单罗列
4. 语言简洁专业

本周统计数据：
- 总工作时长：{workHours} 小时
- 深度工作时长：{deepWorkHours} 小时
- 专注度评分：{focusScore}
- 深度工作占比：{deepWorkPercent}%
- 会议沟通占比：{communicationPercent}%
- 主要应用：{topApps}

每日概况：
{dailySummary}`
};

// 从 localStorage 读取自定义提示词
const getCustomPrompts = (): Partial<typeof DEFAULT_PROMPTS> => {
  try {
    const saved = localStorage.getItem('customPrompts');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('读取自定义提示词失败:', e);
  }
  return {};
};

// 保存自定义提示词到 localStorage
const saveCustomPrompt = (type: keyof typeof DEFAULT_PROMPTS, prompt: string) => {
  try {
    const customPrompts = getCustomPrompts();
    customPrompts[type] = prompt;
    localStorage.setItem('customPrompts', JSON.stringify(customPrompts));
    console.log(`✅ 已保存自定义提示词: ${type}`);
  } catch (e) {
    console.error('保存自定义提示词失败:', e);
  }
};

// 获取当前使用的提示词（自定义或默认）
const getCurrentPrompt = (type: keyof typeof DEFAULT_PROMPTS): string => {
  const customPrompts = getCustomPrompts();
  return customPrompts[type] || DEFAULT_PROMPTS[type];
};

// ==================== 组件开始 ====================

export const InsightsView = ({ onOpenRPGDetail, ai, modelName }: InsightsViewProps) => {
    
    // 数据状态
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [todayEvents, setTodayEvents] = useState<ScreenpipeEvent[]>([]);
    const [overview, setOverview] = useState<TodayOverview>({ workHours: 0, deepWorkHours: 0, tasksCompleted: 0, focusScore: 0 });
    const [timeDistribution, setTimeDistribution] = useState<TimeDistribution>({
        deepWork: { hours: 0, percent: 0 },
        communication: { hours: 0, percent: 0 },
        leisure: { hours: 0, percent: 0 }
    });
    const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
    const [focusPeriods, setFocusPeriods] = useState<FocusPeriod[]>([]);
    const [rpgStats, setRpgStats] = useState<RPGStats>({
        level: 1,
        title: "职场新人",
        strength: 0,
        charisma: 0,
        wisdom: 0,
        chaos: 0,
        xp: 0,
        nextLevelXp: 100
    });
    const [weeklyTrend, setWeeklyTrend] = useState<number[]>([40, 60, 45, 80, 70, 90, 75]);
    const [taskStats, setTaskStats] = useState<TaskStats>({
        weeklyCompleted: 0,
        weeklyCompletedTrend: '+0%',
        avgCompletionDays: 0,
        avgTrend: '-0天',
        fastestCompletion: 0,
        fastestTaskTitle: '-',
        inProgress: 0,
        highPriorityInProgress: 0,
        dailyCompletionCounts: [0, 0, 0, 0, 0, 0, 0]
    });
    
    const [loading, setLoading] = useState(true);
    const [dailyReport, setDailyReport] = useState(mockDailyReport);
    const [leaderReport, setLeaderReport] = useState(''); // 领导版日报
    const [currentVersion, setCurrentVersion] = useState<'self' | 'leader'>('self'); // 当前查看的版本
    const [weeklyReport, setWeeklyReport] = useState(mockWeeklyReport);
    const [generatingDaily, setGeneratingDaily] = useState(false);
    const [generatingLeader, setGeneratingLeader] = useState(false); // 生成领导版状态
    const [generatingWeekly, setGeneratingWeekly] = useState(false);
    const [copiedDaily, setCopiedDaily] = useState(false);
    const [copiedWeekly, setCopiedWeekly] = useState(false);
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
    const [pendingReport, setPendingReport] = useState<{ type: 'daily' | 'weekly', content: string } | null>(null);
    const [editingDaily, setEditingDaily] = useState(false);
    const [editedDailyContent, setEditedDailyContent] = useState('');
    const [editingLeader, setEditingLeader] = useState(false);
    const [editedLeaderContent, setEditedLeaderContent] = useState('');
    const [pushingDaily, setPushingDaily] = useState(false);
    const [showPatInput, setShowPatInput] = useState(false);
    
    // 周报生成方式选择
    const [weeklyGenMethod, setWeeklyGenMethod] = useState<'from_daily' | 'from_raw'>('from_daily'); // 默认从日报生成
    const [weeklyDailyVersion, setWeeklyDailyVersion] = useState<'detailed' | 'leader'>('detailed'); // 使用哪个版本的日报
    
    // 提示词编辑器状态
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [editingPromptType, setEditingPromptType] = useState<'daily_detailed' | 'daily_leader' | 'weekly_from_daily' | 'weekly_from_raw'>('daily_detailed');
    
    // AI 深度分析建议
    const [aiInsight, setAiInsight] = useState<string>('');
    const [generatingInsight, setGeneratingInsight] = useState(false);
    
    // 报告设置
    const [showSettings, setShowSettings] = useState(false);
    const [reportSettings, setReportSettings] = useState<ReportSettings>(() => {
        // 从 localStorage 读取配置
        const saved = localStorage.getItem('reportSettings');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('读取报告设置失败:', e);
            }
        }
        // 默认配置
        return {
            filterStrategy: 'smart' as FilterStrategy,
            customApps: [],
            maxDailyRecords: 800,
            maxWeeklyRecords: 1500
        };
    });

    // 获取所有可用的应用列表（从当前数据中提取）
    const availableApps = useMemo(() => {
        const apps = new Set<string>();
        todayEvents.forEach(event => {
            if (event.appName) {
                apps.add(event.appName);
            }
        });
        return Array.from(apps).sort();
    }, [todayEvents]);

    // 初始化时迁移 localStorage 数据
    useEffect(() => {
        migrateReportsFromLocalStorage();
    }, []);

    // 加载数据
    useEffect(() => {
        const loadData = async () => {
            // 加载每日统计数据
            await loadDailyData(selectedDate);
            
            // 加载该日期的日报（详细版）
            const savedDaily = await getReport('daily', selectedDate);
            if (savedDaily) {
                setDailyReport(savedDaily);
                console.log('📖 [日报-详细版] 从数据库加载:', selectedDate);
            } else {
                setDailyReport(mockDailyReport);
            }
            
            // 加载该日期的领导版日报
            const savedLeader = await getReport('daily_leader' as any, selectedDate);
            if (savedLeader) {
                setLeaderReport(savedLeader);
                console.log('📖 [日报-领导版] 从数据库加载:', selectedDate);
            } else {
                setLeaderReport('');
            }
            
            // 加载本周的周报
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
            const weekKey = weekStart.toISOString().split('T')[0];
            const savedWeekly = await getReport('weekly', weekKey);
            if (savedWeekly) {
                setWeeklyReport(savedWeekly);
                console.log('📖 [周报] 从数据库加载:', weekKey);
            } else {
                setWeeklyReport(mockWeeklyReport);
            }
        };
        
        loadData();
        
        // 如果是今天，每5分钟刷新一次
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        if (selectedDate === todayStr) {
            const interval = setInterval(() => loadData(), 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [selectedDate]);

    // 保存报告设置
    const handleSaveSettings = (settings: ReportSettings) => {
        setReportSettings(settings);
        localStorage.setItem('reportSettings', JSON.stringify(settings));
        console.log('💾 [设置] 已保存:', settings);
    };

    // 保存日报到数据库
    const saveDailyReportToDB = async (content: string, date: string) => {
        const success = await saveReport('daily', date, content);
        if (success) {
            console.log('💾 [日报] 已保存到数据库:', date);
        }
    };

    // 保存周报到数据库
    const saveWeeklyReportToDB = async (content: string) => {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        const weekKey = weekStart.toISOString().split('T')[0];
        const success = await saveReport('weekly', weekKey, content);
        if (success) {
            console.log('💾 [周报] 已保存到数据库:', weekKey);
        }
    };

    // 检查是否有已保存的报告
    const hasExistingDailyReport = async (date: string): Promise<boolean> => {
        const saved = await getReport('daily', date);
        return !!(saved && saved !== mockDailyReport);
    };

    const hasExistingWeeklyReport = async (): Promise<boolean> => {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        const weekKey = weekStart.toISOString().split('T')[0];
        const saved = await getReport('weekly', weekKey);
        return !!(saved && saved !== mockWeeklyReport);
    };

    // 确认覆盖
    const handleConfirmOverwrite = async (confirm: boolean) => {
        if (confirm && pendingReport) {
            if (pendingReport.type === 'daily') {
                setDailyReport(pendingReport.content);
                await saveDailyReportToDB(pendingReport.content, selectedDate);
            } else {
                setWeeklyReport(pendingReport.content);
                await saveWeeklyReportToDB(pendingReport.content);
            }
        }
        setShowOverwriteConfirm(false);
        setPendingReport(null);
    };

    const loadDailyData = async (date: string) => {
        try {
            setLoading(true);
            
            // 首先尝试从数据库加载缓存的统计数据
            const cachedStats = await getDailyStats(date);
            
            if (cachedStats) {
                console.log('📊 [统计] 从数据库加载缓存数据:', date);
                
                // 即使有缓存，也重新计算任务完成数（因为任务状态可能变化）
                let currentTasksCompleted = cachedStats.tasksCompleted;
                try {
                    const allTasks = await storage.getTasks();
                    const dateStart = new Date(date);
                    dateStart.setHours(0, 0, 0, 0);
                    const dateEnd = new Date(date);
                    dateEnd.setHours(23, 59, 59, 999);
                    
                    currentTasksCompleted = allTasks.filter(task => {
                        if (task.status !== 'Done' || !task.completedAt) return false;
                        const completedDate = new Date(task.completedAt);
                        return completedDate >= dateStart && completedDate <= dateEnd;
                    }).length;
                } catch (error) {
                    console.error('❌ 更新任务完成数失败:', error);
                }
                
                setOverview({
                    workHours: cachedStats.workHours,
                    deepWorkHours: cachedStats.deepWorkHours,
                    tasksCompleted: currentTasksCompleted, // 使用最新的任务完成数
                    focusScore: cachedStats.focusScore
                });
                setTimeDistribution(cachedStats.timeDistribution);
                setAppUsage(cachedStats.appUsage);
                setFocusPeriods(cachedStats.focusPeriods);
                setRpgStats(cachedStats.rpgStats);
            }
            
            // 使用 getEventsByDateRange 获取指定日期全天的数据
            const events = await getEventsByDateRange(date);
            setTodayEvents(events);
            
            // 获取该日期完成的任务数
            let tasksCompletedOnDate = 0;
            try {
                const allTasks = await storage.getTasks();
                // 计算指定日期完成的任务数
                const dateStart = new Date(date);
                dateStart.setHours(0, 0, 0, 0);
                const dateEnd = new Date(date);
                dateEnd.setHours(23, 59, 59, 999);
                
                tasksCompletedOnDate = allTasks.filter(task => {
                    if (task.status !== 'Done' || !task.completedAt) return false;
                    const completedDate = new Date(task.completedAt);
                    return completedDate >= dateStart && completedDate <= dateEnd;
                }).length;
                
                console.log(`📊 [统计] ${date} 完成任务数: ${tasksCompletedOnDate}`);
            } catch (error) {
                console.error('❌ 获取任务完成数失败:', error);
            }
            
            if (events.length > 0) {
                const analysis = analyzeTodayEvents(events);
                
                // 使用真实的任务完成数替换硬编码的0
                const overviewWithTasks = {
                    ...analysis.overview,
                    tasksCompleted: tasksCompletedOnDate
                };
                
                setOverview(overviewWithTasks);
                setTimeDistribution(analysis.timeDistribution);
                setAppUsage(analysis.appUsage);
                setFocusPeriods(analysis.focusPeriods);
                
                // 计算RPG属性
                const stats = calculateRPGStats(events);
                setRpgStats(stats);
                
                // 保存统计数据到数据库（用于下次快速加载）
                await saveDailyStats(date, {
                    workHours: analysis.overview.workHours,
                    deepWorkHours: analysis.overview.deepWorkHours,
                    tasksCompleted: tasksCompletedOnDate, // 使用真实的任务完成数
                    focusScore: analysis.overview.focusScore,
                    timeDistribution: analysis.timeDistribution,
                    appUsage: analysis.appUsage,
                    focusPeriods: analysis.focusPeriods,
                    rpgStats: stats
                });
            } else if (!cachedStats) {
                // Reset stats if no data and no cache
                // 即使没有 screenpipe 数据，也显示任务完成数
                setOverview({ workHours: 0, deepWorkHours: 0, tasksCompleted: tasksCompletedOnDate, focusScore: 0 });
                setTimeDistribution({
                    deepWork: { hours: 0, percent: 0 },
                    communication: { hours: 0, percent: 0 },
                    leisure: { hours: 0, percent: 0 }
                });
                setAppUsage([]);
                setFocusPeriods([]);
            } else {
                // 如果有缓存但没有新数据，更新缓存中的任务完成数
                setOverview(prev => ({
                    ...prev,
                    tasksCompleted: tasksCompletedOnDate
                }));
            }
            
            // 获取任务统计（独立于events数据，目前还是全局统计，暂时保持不变）
            // TODO: 如果任务统计也需要支持历史日期，需要修改 taskAnalyzer
            const taskAnalysis = await analyzeTaskStats();
            setTaskStats(taskAnalysis);
            
            // 转换任务完成数为柱状图高度
            const chartHeights = convertToChartHeights(taskAnalysis.dailyCompletionCounts);
            setWeeklyTrend(chartHeights);
        } catch (error) {
            console.error('加载数据失败:', error);
        } finally {
            setLoading(false);
        }
    };
    
    // 数据加载完成后自动生成 AI 建议
    useEffect(() => {
        if (!loading && overview.workHours > 0 && ai && !aiInsight && !generatingInsight) {
            const timer = setTimeout(() => {
                generateAIInsight();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [loading, overview.workHours, ai]);

    const handleCopyToClipboard = async (text: string, type: 'daily' | 'weekly') => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === 'daily') {
                setCopiedDaily(true);
                setTimeout(() => setCopiedDaily(false), 2000);
            } else {
                setCopiedWeekly(true);
                setTimeout(() => setCopiedWeekly(false), 2000);
            }
        } catch (err) {
            console.error('复制失败:', err);
        }
    };

    // 开始编辑详细版日报
    const handleEditDaily = () => {
        setEditedDailyContent(dailyReport);
        setEditingDaily(true);
    };

    // 保存编辑后的详细版日报
    const handleSaveDaily = async () => {
        setDailyReport(editedDailyContent);
        await saveDailyReportToDB(editedDailyContent, selectedDate);
        setEditingDaily(false);
        console.log('💾 [日报-详细版] 手动编辑已保存');
    };

    // 取消编辑详细版
    const handleCancelEdit = () => {
        setEditingDaily(false);
        setEditedDailyContent('');
    };

    // 开始编辑汇报版日报
    const handleEditLeader = () => {
        setEditedLeaderContent(leaderReport);
        setEditingLeader(true);
    };

    // 保存编辑后的汇报版日报
    const handleSaveLeader = async () => {
        setLeaderReport(editedLeaderContent);
        await saveReport('daily_leader' as any, selectedDate, editedLeaderContent);
        setEditingLeader(false);
        console.log('💾 [日报-汇报版] 手动编辑已保存');
    };

    // 取消编辑汇报版
    const handleCancelEditLeader = () => {
        setEditingLeader(false);
        setEditedLeaderContent('');
    };

    // 生成领导版日报
    const handleGenerateLeaderReport = async () => {
        console.log('👔 [领导版日报] 开始生成...');
        
        if (!dailyReport || dailyReport === mockDailyReport) {
            alert('请先生成详细版日报');
            return;
        }
        
        if (!ai) {
            alert('请先在设置中配置 AI API Key');
            return;
        }
        
        setGeneratingLeader(true);
        
        try {
            // 获取并使用自定义提示词
            let promptTemplate = getCurrentPrompt('daily_leader');
            
            // 替换提示词中的变量
            const promptContent = promptTemplate
                .replace(/{date}/g, selectedDate)
                .replace(/{workHours}/g, overview.workHours.toFixed(1))
                .replace(/{deepWorkHours}/g, overview.deepWorkHours.toFixed(1))
                .replace(/{focusScore}/g, String(overview.focusScore))
                .replace(/{tasksCompleted}/g, String(overview.tasksCompleted))
                .replace(/{deepWorkPercent}/g, String(timeDistribution.deepWork.percent))
                .replace(/{communicationPercent}/g, String(timeDistribution.communication.percent))
                .replace(/{topApps}/g, appUsage.slice(0, 5).map(a => `${a.appName} (${(a.totalMinutes / 60).toFixed(1)}h)`).join(', '));
            
            // 构建完整的 prompt
            const fullPrompt = `${promptContent}

## 原始工作记录（详细版日报）

${dailyReport}

请直接输出工作日报（Markdown 格式）：`;

            // 基于详细版日报生成领导版
            console.log('👔 [领导版日报] 使用自定义提示词生成...');
            const response = await ai.generateContent({
                model: modelName,
                contents: fullPrompt
            });
            
            const leaderReportContent = response.text.trim();
            setLeaderReport(leaderReportContent);
            
            // 保存到数据库（使用不同的 type）
            await saveReport('daily_leader' as any, selectedDate, leaderReportContent);
            
            // 自动切换到领导版查看
            setCurrentVersion('leader');
            
            console.log('✅ [领导版日报] 生成成功并已保存');
            
        } catch (error: any) {
            console.error('❌ [领导版日报] 生成失败:', error);
            alert(`生成失败: ${error.message || error}`);
        } finally {
            setGeneratingLeader(false);
        }
    };

    // 点击推送按钮（只推送领导版）
    const handleClickPush = () => {
        if (currentVersion !== 'leader' || !leaderReport) {
            alert('请先生成领导版日报，只有领导版可以推送');
            return;
        }
        setShowPatInput(true);
    };

    // 确认推送（用户输入 PAT 后）- 只推送领导版
    const handleConfirmPush = async (pat: string) => {
        setShowPatInput(false);
        console.log('📤 [推送] 开始推送领导版日报...');
        setPushingDaily(true);
        
        try {
            // 调用 Tauri 命令推送日报（使用领导版内容）
            const result = await invoke('push_daily_report', {
                date: selectedDate,
                content: leaderReport,
                githubPat: pat
            });
            
            console.log('✅ [推送] 成功:', result);
            alert('领导版日报推送成功！');
        } catch (error) {
            console.error('❌ [推送] 失败:', error);
            alert(`推送失败: ${error}`);
        } finally {
            setPushingDaily(false);
        }
    };

    // 取消推送
    const handleCancelPush = () => {
        setShowPatInput(false);
        console.log('❌ [推送] 用户取消');
    };

    // 生成 AI 深度分析建议
    const generateAIInsight = async (forceRegenerate: boolean = false) => {
        console.log('🤖 [AI分析] 开始生成深度分析建议...');
        
        if (!ai) {
            console.warn('⚠️ [AI分析] AI 未配置');
            setAiInsight('请先在设置中配置 AI API Key');
            return;
        }

        if (overview.workHours === 0) {
            console.warn('⚠️ [AI分析] 没有足够的数据');
            setAiInsight('暂无数据，待积累更多工作记录后再来看看～');
            return;
        }

        // 如果不是强制重新生成，先检查数据库中是否有缓存
        if (!forceRegenerate) {
            const cachedInsight = await getReport('ai_insight' as any, selectedDate);
            if (cachedInsight) {
                console.log('📖 [AI分析] 从数据库加载缓存:', selectedDate);
                setAiInsight(cachedInsight);
                return;
            }
        }

        setGeneratingInsight(true);
        
        try {
            // 准备数据摘要
            const dataSummary = {
                date: selectedDate,
                workHours: overview.workHours.toFixed(1),
                deepWorkHours: overview.deepWorkHours.toFixed(1),
                focusScore: overview.focusScore,
                deepWorkPercent: timeDistribution.deepWork.percent,
                communicationPercent: timeDistribution.communication.percent,
                leisurePercent: timeDistribution.leisure.percent,
                topApps: appUsage.slice(0, 5).map(a => ({
                    name: a.appName,
                    hours: (a.totalMinutes / 60).toFixed(1)
                })),
                focusPeriods: focusPeriods.map(p => ({
                    type: p.type === 'best' ? '最佳' : '低效',
                    time: p.timeRange,
                    description: p.description
                }))
            };

            console.log('🤖 [AI分析] 数据摘要:', dataSummary);

            // 调用 AI 生成建议
            const response = await ai.generateContent({
                model: modelName,
                contents: `
你是一位温暖、鼓励型的效率管理教练。根据用户的工作数据，提供积极、正面的效率分析和鼓励。

数据概览：
- 日期：${dataSummary.date}
- 总工作时长：${dataSummary.workHours} 小时
- 深度工作：${dataSummary.deepWorkHours} 小时 (${dataSummary.deepWorkPercent}%)
- 专注度评分：${dataSummary.focusScore}
- 会议沟通：${dataSummary.communicationPercent}%
- 休息摸鱼：${dataSummary.leisurePercent}%

主要应用使用情况：
${dataSummary.topApps.map(a => `- ${a.name}: ${a.hours}h`).join('\n')}

专注时段分析：
${dataSummary.focusPeriods.map(p => `- ${p.type}时段 ${p.time}: ${p.description}`).join('\n')}

要求：
1. **以鼓励和赞美为主**，从积极的角度分析数据
2. 用4-6句话，包含：
   - 开头用夸赞和肯定（如"太棒了"、"做得很好"、"真的很努力"等）
   - 具体指出做得好的地方（用数据支撑）
   - 温和地提供1-2条改进建议（用"可以试试"、"或许能"等柔和语气）
   - 结尾用鼓励的话语
3. 语言要亲切、温暖、像朋友一样
4. 总长度在150-200字
5. 不要使用emoji、标题、序号或markdown格式，直接输出纯文本
6. 即使数据不理想，也要从正面角度鼓励

示例风格：
"今天表现真不错！工作了7.5小时，深度工作占比达到65%，专注度也有85分，这说明你的时间管理很到位。特别是上午11-12点这个时段，连续工作效率很高。下午稍微有些分心是正常的，人的精力曲线本来就是这样的。建议可以在下午适当休息一下，喝杯咖啡或者散散步，会更有利于保持状态。继续保持这样的节奏，你会越来越优秀的！"

请直接输出建议内容（不要有任何其他说明）：
                `
            });

            const insight = response.text.trim();
            setAiInsight(insight);
            
            // 保存到数据库
            await saveReport('ai_insight' as any, selectedDate, insight);
            
            console.log('✅ [AI分析] 生成成功并已保存');
            console.log('📝 [AI分析] 内容:', insight);
            
        } catch (error: any) {
            console.error('❌ [AI分析] 生成失败:', error);
            console.error('❌ [AI分析] 错误详情:', error.message);
            setAiInsight('生成失败，请稍后重试或检查 API 配置');
        } finally {
            setGeneratingInsight(false);
        }
    };

    // 当日期变化时清空 AI 建议
    useEffect(() => {
        setAiInsight('');
    }, [selectedDate]);

    // ==================== 提示词编辑处理 ====================
    
    const handleOpenPromptEditor = (type: 'daily_detailed' | 'daily_leader' | 'weekly_from_daily' | 'weekly_from_raw') => {
        setEditingPromptType(type);
        setShowPromptEditor(true);
    };

    const handleSavePrompt = (prompt: string) => {
        saveCustomPrompt(editingPromptType, prompt);
        alert(`✅ 提示词已保存！下次生成${
            editingPromptType === 'daily_detailed' ? '详细版日报' :
            editingPromptType === 'daily_leader' ? '汇报版日报' :
            editingPromptType === 'weekly_from_daily' ? '周报（从日报）' :
            '周报（从原始数据）'
        }时将使用新的提示词。`);
    };

    const getPromptVariables = (type: 'daily_detailed' | 'daily_leader' | 'weekly_from_daily' | 'weekly_from_raw') => {
        const baseVars = [
            { name: '{date}', description: '日期' }
        ];
        
        if (type.startsWith('daily')) {
            return [
                ...baseVars,
                { name: '{workHours}', description: '工作时长' },
                { name: '{deepWorkHours}', description: '深度工作时长' },
                { name: '{focusScore}', description: '专注度评分' },
                { name: '{tasksCompleted}', description: '完成任务数' },
                { name: '{deepWorkPercent}', description: '深度工作占比' },
                { name: '{communicationPercent}', description: '会议沟通占比' },
                { name: '{topApps}', description: '主要使用的应用' }
            ];
        } else {
            return [
                { name: '{weekStart}', description: '周开始日期' },
                { name: '{weekEnd}', description: '周结束日期' },
                { name: '{workHours}', description: '总工作时长' },
                { name: '{deepWorkHours}', description: '深度工作时长' },
                { name: '{focusScore}', description: '专注度评分' },
                { name: '{deepWorkPercent}', description: '深度工作占比' },
                { name: '{communicationPercent}', description: '会议沟通占比' },
                { name: '{topApps}', description: '主要应用' },
                { name: '{dailyReportsText}', description: '本周日报内容（仅周报）' },
                { name: '{dailySummary}', description: '每日概况（仅周报）' }
            ];
        }
    };

    // ==================== 日报生成 ====================

    const handleGenerateDailyReport = async () => {
        console.log('🔵 [日报] 点击了重新生成按钮');
        console.log('🔵 [日报] 当前日期:', selectedDate);
        console.log('🔵 [日报] todayEvents 长度:', todayEvents.length);
        
        setGeneratingDaily(true);
        
        try {
            // 1. 使用当前显示的事件数据
            const events = todayEvents;
            
            if (events.length === 0) {
                console.warn('⚠️ [日报] 没有数据！');
                alert('该日期没有足够的活动数据');
                setGeneratingDaily(false);
                return;
            }

            console.log('🔵 [日报] 开始生成，数据条数:', events.length);
            console.log('🔵 [日报] API Key 存在:', !!import.meta.env.VITE_GEMINI_API_KEY);
            console.log('🔵 [日报] 使用筛选策略:', reportSettings.filterStrategy);

            // 2. 使用选定的筛选策略
            const filteredEvents = filterEvents(
                events,
                reportSettings.filterStrategy,
                reportSettings.customApps,
                reportSettings.maxDailyRecords
            );

            console.log('🔵 [日报] 筛选后数据条数:', filteredEvents.length);

            if (filteredEvents.length === 0) {
                console.warn('⚠️ [日报] 筛选后没有数据！');
                alert('筛选后没有数据，请检查筛选设置或选择其他日期');
                setGeneratingDaily(false);
                return;
            }

            // 3. 生成摘要
            const summary = filteredEvents.map(e => ({
                time: new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                app: e.appName,
                window: e.windowTitle?.substring(0, 50) || '',
                text: e.content?.substring(0, 80) || ''
            }));

            console.log('🔵 [日报] 最终数据条数:', summary.length);
            console.log('🔵 [日报] 数据样本:', summary.slice(0, 3));

            // 检查 AI 客户端
            if (!ai) {
                alert('请先在设置中配置 AI API Key');
                return;
            }

            // 3. 准备统计数据
            const statsData = {
                workHours: overview.workHours.toFixed(1),
                deepWorkHours: overview.deepWorkHours.toFixed(1),
                focusScore: overview.focusScore,
                tasksCompleted: overview.tasksCompleted,
                deepWorkPercent: timeDistribution.deepWork.percent,
                communicationPercent: timeDistribution.communication.percent,
                topApps: appUsage.slice(0, 5).map(a => `${a.appName} (${(a.totalMinutes / 60).toFixed(1)}h)`).join(', ')
            };

            // 4. 获取并使用自定义提示词
            let promptTemplate = getCurrentPrompt('daily_detailed');
            
            // 替换提示词中的变量
            const promptContent = promptTemplate
                .replace(/{date}/g, selectedDate)
                .replace(/{workHours}/g, statsData.workHours)
                .replace(/{deepWorkHours}/g, statsData.deepWorkHours)
                .replace(/{focusScore}/g, String(statsData.focusScore))
                .replace(/{tasksCompleted}/g, String(statsData.tasksCompleted))
                .replace(/{deepWorkPercent}/g, String(statsData.deepWorkPercent))
                .replace(/{communicationPercent}/g, String(statsData.communicationPercent))
                .replace(/{topApps}/g, statsData.topApps);
            
            // 构建完整的 prompt（提示词 + 数据）
            const fullPrompt = `${promptContent}

## 工作统计数据
- 总工作时长：${statsData.workHours} 小时
- 深度工作时长：${statsData.deepWorkHours} 小时 (${statsData.deepWorkPercent}%)
- 专注度评分：${statsData.focusScore}/100
- 完成任务数：${statsData.tasksCompleted} 个
- 会议沟通占比：${statsData.communicationPercent}%
- 主要工具：${statsData.topApps}

## 活动日志明细
${JSON.stringify(summary, null, 2)}

请直接输出完整的 Markdown 格式日报：`;

            // 5. 调用 AI 生成报告
            console.log('🔵 [日报] 开始调用 AI（使用自定义提示词）...');
            const response = await ai.generateContent({
                model: modelName,
                contents: fullPrompt
            });

            console.log('✅ [日报] Gemini API 调用成功');
            console.log('✅ [日报] 生成的报告（前200字符）:', response.text.substring(0, 200));
            
            // 检查是否已有保存的报告
            const hasExisting = await hasExistingDailyReport(selectedDate);
            if (hasExisting) {
                // 有已保存的报告，询问是否覆盖
                console.log('⚠️ [日报] 发现已保存的报告，询问是否覆盖');
                setPendingReport({ type: 'daily', content: response.text });
                setShowOverwriteConfirm(true);
            } else {
                // 没有已保存的报告，直接保存
                setDailyReport(response.text);
                await saveDailyReportToDB(response.text, selectedDate);
                console.log('✅ [日报] 报告已更新并保存');
            }
            
        } catch (error) {
            console.error('❌ [日报] 生成失败:', error);
            console.error('❌ [日报] 错误详情:', error.message);
            console.error('❌ [日报] 错误堆栈:', error.stack);
            alert('生成失败，请检查 API Key 配置或稍后重试');
        } finally {
            setGeneratingDaily(false);
            console.log('🔵 [日报] 生成流程结束');
        }
    };

    // 获取本周所有日报的辅助函数
    const getWeekDailyReports = async (version: 'detailed' | 'leader') => {
        const reports: Array<{ date: string; content: string }> = [];
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
        weekStart.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + i);
            const dateStr = dayDate.toLocaleDateString('en-CA'); // YYYY-MM-DD 格式
            
            // 根据版本选择加载详细版或汇报版日报
            const reportType = version === 'detailed' ? 'daily' : 'daily_leader';
            const reportContent = await getReport(reportType as any, dateStr);
            
            if (reportContent) {
                reports.push({ date: dateStr, content: reportContent });
            }
        }
        
        return reports;
    };

    const handleGenerateWeeklyReport = async () => {
        console.log('🟣 [周报] 点击了重新生成按钮');
        console.log('🟣 [周报] 生成方式:', weeklyGenMethod);
        console.log('🟣 [周报] 日报版本:', weeklyDailyVersion);
        
        setGeneratingWeekly(true);
        
        try {
            // 检查 AI 客户端
            if (!ai) {
                alert('请先在设置中配置 AI API Key');
                setGeneratingWeekly(false);
                return;
            }

            let response;
            const today = new Date();
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
            weekStart.setHours(0, 0, 0, 0);

            if (weeklyGenMethod === 'from_daily') {
                // ========== 方式1: 从日报生成周报 ==========
                console.log('🟣 [周报] 从日报生成周报...');
                const dailyReports = await getWeekDailyReports(weeklyDailyVersion);
                
                if (dailyReports.length === 0) {
                    alert(`本周还没有${weeklyDailyVersion === 'detailed' ? '详细版' : '汇报版'}日报，请先生成日报或选择从原始数据生成`);
                    setGeneratingWeekly(false);
                    return;
                }

                console.log('🟣 [周报] 找到日报数量:', dailyReports.length);

                // 构建日报汇总文本
                const dailyReportsText = dailyReports.map(r => {
                    const dateObj = new Date(r.date);
                    const dateStr = dateObj.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
                    return `\n### ${dateStr}\n${r.content}\n`;
                }).join('\n---\n');

                // 获取并使用自定义提示词
                let promptTemplate = getCurrentPrompt('weekly_from_daily');
                const promptContent = promptTemplate
                    .replace(/{weekStart}/g, weekStart.toLocaleDateString('zh-CN'))
                    .replace(/{weekEnd}/g, today.toLocaleDateString('zh-CN'))
                    .replace(/{dailyReportsText}/g, dailyReportsText);

                console.log('🟣 [周报] 使用自定义提示词（从日报生成）...');
                response = await ai.generateContent({
                    model: modelName,
                    contents: promptContent
                });

            } else {
                // ========== 方式2: 从原始数据生成周报 ==========
                console.log('🟣 [周报] 从原始数据生成周报...');
                
                // 1. 获取本周的事件
                console.log('🟣 [周报] 开始获取本周数据...');
                const weekEvents = await getWeekEvents();
                console.log('🟣 [周报] 获取到数据条数:', weekEvents.length);
            
                if (weekEvents.length === 0) {
                    console.warn('⚠️ [周报] 本周没有数据！');
                    alert('本周还没有足够的活动数据');
                    setGeneratingWeekly(false);
                    return;
                }

                // 2. 使用选定的筛选策略
                console.log('🟣 [周报] 原始数据条数:', weekEvents.length);
                console.log('🟣 [周报] 使用筛选策略:', reportSettings.filterStrategy);
                
                const sampledWeekEvents = filterEvents(
                    weekEvents,
                    reportSettings.filterStrategy,
                    reportSettings.customApps,
                    reportSettings.maxWeeklyRecords
                );

                console.log('🟣 [周报] 筛选后数据条数:', sampledWeekEvents.length);

                if (sampledWeekEvents.length === 0) {
                    console.warn('⚠️ [周报] 筛选后没有数据！');
                    alert('筛选后没有数据，请检查筛选设置');
                    setGeneratingWeekly(false);
                    return;
                }
                
                // 3. 按天分组统计
                const dailySummaries = [];
                
                for (let i = 0; i < 7; i++) {
                    const dayStart = new Date(weekStart);
                    dayStart.setDate(weekStart.getDate() + i);
                    const dayEnd = new Date(dayStart);
                    dayEnd.setHours(23, 59, 59, 999);
                    
                    const dayEvents = sampledWeekEvents.filter(e => {
                        const eventTime = new Date(e.timestamp);
                        return eventTime >= dayStart && eventTime <= dayEnd;
                    });
                    
                    if (dayEvents.length > 0) {
                        const dayAnalysis = analyzeTodayEvents(dayEvents);
                        dailySummaries.push({
                            date: dayStart.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' }),
                            workHours: dayAnalysis.overview.workHours,
                            deepWorkHours: dayAnalysis.overview.deepWorkHours,
                            topApps: dayAnalysis.appUsage.slice(0, 3).map(a => a.appName).join(', ')
                        });
                    }
                }

                // 4. 整体统计
                const weekAnalysis = analyzeTodayEvents(sampledWeekEvents);
                
                console.log('🟣 [周报] 开始调用 Gemini API...');
                console.log('🟣 [周报] 日期范围:', weekStart.toLocaleDateString('zh-CN'), '~', today.toLocaleDateString('zh-CN'));
                console.log('🟣 [周报] 工作时长:', weekAnalysis.overview.workHours.toFixed(1), '小时');

                // 获取并使用自定义提示词
                const dailySummaryText = dailySummaries.map(d => 
                    `- ${d.date}: 工作 ${d.workHours.toFixed(1)}h, 深度工作 ${d.deepWorkHours.toFixed(1)}h, 主要: ${d.topApps}`
                ).join('\n');

                let promptTemplate = getCurrentPrompt('weekly_from_raw');
                const promptContent = promptTemplate
                    .replace(/{weekStart}/g, weekStart.toLocaleDateString('zh-CN'))
                    .replace(/{weekEnd}/g, today.toLocaleDateString('zh-CN'))
                    .replace(/{workHours}/g, weekAnalysis.overview.workHours.toFixed(1))
                    .replace(/{deepWorkHours}/g, weekAnalysis.overview.deepWorkHours.toFixed(1))
                    .replace(/{focusScore}/g, String(weekAnalysis.overview.focusScore))
                    .replace(/{deepWorkPercent}/g, String(weekAnalysis.timeDistribution.deepWork.percent))
                    .replace(/{communicationPercent}/g, String(weekAnalysis.timeDistribution.communication.percent))
                    .replace(/{topApps}/g, weekAnalysis.appUsage.map(a => a.appName).join(', '))
                    .replace(/{dailySummary}/g, dailySummaryText);

                console.log('🟣 [周报] 使用自定义提示词（从原始数据生成）...');
                response = await ai.generateContent({
                    model: modelName,
                    contents: promptContent
                });
            }

            console.log('✅ [周报] Gemini API 调用成功');
            console.log('✅ [周报] 生成的报告（前200字符）:', response.text.substring(0, 200));
            
            // 检查是否已有保存的报告
            const hasExisting = await hasExistingWeeklyReport();
            if (hasExisting) {
                // 有已保存的报告，询问是否覆盖
                console.log('⚠️ [周报] 发现已保存的报告，询问是否覆盖');
                setPendingReport({ type: 'weekly', content: response.text });
                setShowOverwriteConfirm(true);
            } else {
                // 没有已保存的报告，直接保存
                setWeeklyReport(response.text);
                await saveWeeklyReportToDB(response.text);
                console.log('✅ [周报] 报告已更新并保存');
            }
            
        } catch (error) {
            console.error('❌ [周报] 生成失败:', error);
            console.error('❌ [周报] 错误详情:', error.message);
            console.error('❌ [周报] 错误堆栈:', error.stack);
            alert('生成失败，请检查 API Key 配置或稍后重试');
        } finally {
            setGeneratingWeekly(false);
            console.log('🟣 [周报] 生成流程结束');
        }
    };
    
    const isToday = selectedDate === new Date().toLocaleDateString('en-CA');
    const displayDate = isToday ? '今日' : selectedDate;

    return (
        <div className="h-full w-full overflow-y-auto p-6 pb-24 grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            
            {/* Main Content: Data Analysis */}
            <div className="space-y-6">
                
                {/* Today's Overview */}
                <div className="glass p-8 rounded-3xl border border-white/60 relative overflow-hidden group">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-sky-100/40 to-cyan-100/40 rounded-full blur-3xl -z-10 pointer-events-none group-hover:scale-125 transition-transform duration-1000"></div>
                    
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-stone-700 flex items-center gap-2 text-lg">
                            <ClockIcon className="w-5 h-5 text-sky-500"/>
                            {displayDate}工作概览
                        </h3>
                        
                        <div className="flex items-center bg-white/50 rounded-xl p-1 border border-white/60">
                            <div className="relative flex items-center gap-2 px-3 py-1.5">
                                <CalendarIcon className="w-4 h-4 text-stone-500"/>
                                <input 
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="bg-transparent border-none p-0 text-sm font-bold text-stone-600 focus:ring-0 cursor-pointer w-28"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "工作时长", value: overview.workHours.toFixed(1), unit: "小时", color: "from-sky-400 to-cyan-400", icon: "⏱️" },
                            { label: "深度工作", value: overview.deepWorkHours.toFixed(1), unit: "小时", color: "from-emerald-400 to-teal-400", icon: "🎯" },
                            { label: "任务完成", value: overview.tasksCompleted.toString(), unit: "个", color: "from-violet-400 to-purple-400", icon: "✅" },
                            { label: "专注度", value: overview.focusScore.toString(), unit: "%", color: "from-rose-400 to-pink-400", icon: "🔥" },
                        ].map(stat => (
                            <div key={stat.label} className="bg-white/80 rounded-2xl p-5 border border-white shadow-sm hover:shadow-md transition-all group/card">
                                <div className="text-3xl mb-2">{stat.icon}</div>
                                <div className={`text-3xl font-black bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-1`}>
                                    {loading ? '-' : stat.value}
                                </div>
                                <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{stat.label}</div>
                                <div className="text-xs text-stone-500 mt-0.5">{stat.unit}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Work Distribution & App Usage */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Work Time Distribution */}
                    <div className="glass p-6 rounded-3xl border border-white/60">
                        <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2">
                            <ChartPieIcon className="w-5 h-5 text-stone-400"/>
                            时间分布
                        </h3>
                        
                        {loading ? (
                            <div className="h-40 flex items-center justify-center text-stone-400 text-xs">
                                加载中...
                            </div>
                        ) : (
                        <>
                        {/* Pie-like bars */}
                        <div className="space-y-3 mb-4">
                            {[
                                { label: "深度工作", hours: timeDistribution.deepWork.hours, percent: timeDistribution.deepWork.percent, color: "bg-emerald-400" },
                                { label: "会议沟通", hours: timeDistribution.communication.hours, percent: timeDistribution.communication.percent, color: "bg-amber-400" },
                                { label: "休息摸鱼", hours: timeDistribution.leisure.hours, percent: timeDistribution.leisure.percent, color: "bg-rose-400" },
                            ].map(item => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-xs font-bold mb-1.5">
                                        <span className="text-stone-600">{item.label}</span>
                                        <span className="text-stone-500">{item.hours}h ({item.percent}%)</span>
                                    </div>
                                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full ${item.color} transition-all duration-1000`}
                                            style={{ width: `${item.percent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {timeDistribution.deepWork.percent >= 60 ? (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs">
                                <span className="font-bold text-emerald-700">✅ 保持专注</span>
                                <p className="text-emerald-600 mt-1">深度工作占比超过目标值 60%</p>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs">
                                <span className="font-bold text-amber-700">⚠️ 需要改进</span>
                                <p className="text-amber-600 mt-1">深度工作占比 {timeDistribution.deepWork.percent}%，建议提升至 60% 以上</p>
                            </div>
                        )}
                        </>
                        )}
                    </div>

                    {/* Top Applications */}
                    <div className="glass p-6 rounded-3xl border border-white/60">
                        <h3 className="font-bold text-stone-700 mb-4 flex items-center gap-2">
                            <EyeIcon className="w-5 h-5 text-stone-400"/>
                            应用使用 Top 5
                        </h3>
                        
                        <div className="space-y-3">
                            {loading ? (
                                <div className="h-40 flex items-center justify-center text-stone-400 text-xs">
                                    加载中...
                                </div>
                            ) : appUsage.length > 0 ? appUsage.map((app, idx) => {
                                const colors = ["bg-blue-400", "bg-amber-400", "bg-purple-400", "bg-stone-400", "bg-pink-400"];
                                return (
                                <div key={app.appName} className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-lg shadow-sm border border-stone-100">
                                        {app.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs font-bold mb-1">
                                            <span className="text-stone-700">{app.appName}</span>
                                            <span className="text-stone-500">{(app.totalMinutes / 60).toFixed(1)}h</span>
                                        </div>
                                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${colors[idx]}`}
                                                style={{ width: `${app.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            );
                            }) : (
                                <div className="text-center text-stone-400 text-xs py-4">
                                    暂无数据
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Focus Analysis & Suggestions */}
                <div className="glass p-8 rounded-3xl border border-white/60 relative overflow-hidden group">
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-violet-100/40 to-fuchsia-100/40 rounded-full blur-3xl -z-10 pointer-events-none group-hover:scale-125 transition-transform duration-1000"></div>
                    
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="font-bold text-stone-700 flex items-center gap-2 text-lg">
                            <SparklesIcon className="w-5 h-5 text-violet-500"/>
                            效率分析与建议
                        </h3>
                    </div>

                    {/* AI 深度分析 */}
                    {ai && (
                        <div className="mb-6 bg-gradient-to-br from-violet-50 to-fuchsia-50 border-2 border-violet-200 rounded-2xl p-5 relative">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🤖</span>
                                    <h4 className="text-sm font-bold text-violet-700">AI 深度分析</h4>
                                </div>
                                <button
                                    onClick={() => generateAIInsight(true)}
                                    disabled={generatingInsight || loading}
                                    className="text-xs text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="重新生成 AI 分析"
                                >
                                    <SparklesIcon className="w-3 h-3" />
                                    {generatingInsight ? '生成中...' : '刷新'}
                                </button>
                            </div>
                            <div className="text-sm text-violet-900 leading-[1.8]">
                                {generatingInsight ? (
                                    <div className="flex items-center gap-2 text-violet-600">
                                        <div className="animate-spin">⚙️</div>
                                        <span>AI 正在用心分析你的工作数据...</span>
                                    </div>
                                ) : aiInsight ? (
                                    <p className="whitespace-pre-line">{aiInsight}</p>
                                ) : (
                                    <p className="text-violet-600">✨ 点击右上角刷新按钮，让 AI 为你生成专属的鼓励和建议</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Focus Periods */}
                        <div>
                            <h4 className="text-sm font-bold text-stone-600 mb-3">⚡ 专注时段分析</h4>
                            <div className="space-y-3">
                                {loading ? (
                                    <div className="text-center text-stone-400 text-xs py-4">
                                        分析中...
                                    </div>
                                ) : focusPeriods.length > 0 ? focusPeriods.map(period => (
                                    <div 
                                        key={period.timeRange}
                                        className={`${
                                            period.type === 'best' 
                                                ? 'bg-emerald-50 border border-emerald-100' 
                                                : 'bg-amber-50 border border-amber-100'
                                        } rounded-xl p-4`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-xs font-bold ${
                                                period.type === 'best' ? 'text-emerald-700' : 'text-amber-700'
                                            }`}>
                                                {period.type === 'best' ? '最佳状态' : '效率下降'}
                                            </span>
                                            <span className={`text-xs font-mono ${
                                                period.type === 'best' ? 'text-emerald-600' : 'text-amber-600'
                                            }`}>
                                                {period.timeRange}
                                            </span>
                                        </div>
                                        <p className={`text-xs ${
                                            period.type === 'best' ? 'text-emerald-600' : 'text-amber-600'
                                        }`}>
                                            {period.description}
                                        </p>
                                    </div>
                                )) : (
                                    <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
                                        <p className="text-xs text-stone-500">数据积累中...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* AI Suggestions */}
                        <div>
                            <h4 className="text-sm font-bold text-stone-600 mb-3">💡 智能建议</h4>
                            <div className="space-y-2">
                                {(() => {
                                    const suggestions = [];
                                    
                                    // 根据专注时段生成建议
                                    const bestPeriod = focusPeriods.find(p => p.type === 'best');
                                    if (bestPeriod) {
                                        suggestions.push({ 
                                            icon: "🎯", 
                                            text: `将重要任务安排在 ${bestPeriod.timeRange}`, 
                                            type: "success" 
                                        });
                                    }
                                    
                                    const worstPeriod = focusPeriods.find(p => p.type === 'worst');
                                    if (worstPeriod) {
                                        suggestions.push({ 
                                            icon: "☕", 
                                            text: `${worstPeriod.timeRange} 建议安排休息或轻度任务`, 
                                            type: "warning" 
                                        });
                                    }
                                    
                                    // 根据深度工作占比生成建议
                                    if (timeDistribution.deepWork.percent < 60) {
                                        suggestions.push({ 
                                            icon: "⚡", 
                                            text: `深度工作占比较低(${timeDistribution.deepWork.percent}%)，建议减少干扰`, 
                                            type: "warning" 
                                        });
                                    } else {
                                        suggestions.push({ 
                                            icon: "📊", 
                                            text: `深度工作占比 ${timeDistribution.deepWork.percent}%，保持节奏`, 
                                            type: "success" 
                                        });
                                    }
                                    
                                    // 根据专注度生成建议
                                    if (overview.focusScore >= 80) {
                                        suggestions.push({ 
                                            icon: "🔥", 
                                            text: `专注度很高(${overview.focusScore}分)，继续保持！`, 
                                            type: "success" 
                                        });
                                    }
                                    
                                    if (loading) return <div className="text-center text-stone-400 text-xs py-4">分析中...</div>;

                                    return suggestions.slice(0, 3).map((tip, idx) => (
                                    <div key={idx} className={`
                                        rounded-xl p-3 text-xs flex items-start gap-2
                                        ${tip.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : ''}
                                        ${tip.type === 'warning' ? 'bg-amber-50 border border-amber-100 text-amber-700' : ''}
                                        ${tip.type === 'info' ? 'bg-sky-50 border border-sky-100 text-sky-700' : ''}
                                    `}>
                                        <span>{tip.icon}</span>
                                        <span className="font-semibold flex-1">{tip.text}</span>
                                    </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Task Completion Stats */}
                <div className="glass p-8 rounded-3xl border border-white/60">
                    <h3 className="font-bold text-stone-700 mb-6 flex items-center gap-2 text-lg">
                        <FileTextIcon className="w-5 h-5 text-stone-400"/>
                        任务完成情况
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        {[
                            { label: "本周完成", value: taskStats.weeklyCompleted.toString(), trend: taskStats.weeklyCompletedTrend, up: taskStats.weeklyCompletedTrend.startsWith('+') },
                            { label: "平均耗时", value: taskStats.avgCompletionDays.toFixed(1), unit: "天", trend: taskStats.avgTrend, up: taskStats.avgTrend.startsWith('-') },
                            { label: "最快完成", value: taskStats.fastestCompletion.toString(), unit: "小时", trend: taskStats.fastestTaskTitle, up: false },
                            { label: "进行中", value: taskStats.inProgress.toString(), trend: `${taskStats.highPriorityInProgress}个高优先级`, up: false },
                        ].map(stat => (
                            <div key={stat.label}>
                                <div className="text-2xl font-black text-stone-700 mb-1">
                                    {stat.value}<span className="text-sm font-normal text-stone-400 ml-1">{stat.unit}</span>
                                    </div>
                                <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wide mb-1">{stat.label}</div>
                                <div className={`text-xs font-semibold ${stat.up ? 'text-emerald-600' : 'text-stone-500'}`}>
                                    {stat.trend}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Weekly Trend Mini Chart */}
                    <div className="bg-white/50 rounded-xl p-4 border border-stone-100">
                        <div className="text-xs font-bold text-stone-600 mb-3">本周完成趋势</div>
                        <div className="flex gap-2 h-24 items-end">
                            {weeklyTrend.length > 0 ? weeklyTrend.map((height, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                    <div 
                                        className={`w-full rounded-t-lg transition-all ${
                                            idx === 6 ? 'bg-violet-400' : 'bg-stone-300 hover:bg-stone-400'
                                        }`}
                                        style={{ 
                                            height: `${height}%`,
                                            minHeight: height > 0 ? '8px' : '0px'  // 确保有数据时至少显示8px
                                        }}
                                    ></div>
                                    <span className="text-[9px] text-stone-400 font-bold">
                                        {['周一', '周二', '周三', '周四', '周五', '周六', '今日'][idx]}
                                    </span>
                                </div>
                            )) : (
                                <div className="w-full text-center text-stone-400 text-xs">
                                    暂无数据
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar: RPG Character + Reports */}
            <div className="space-y-6">
                
                {/* Mini RPG Character Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-white shadow-xl shadow-violet-100/50 relative overflow-hidden group hover-lift">
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-br from-violet-100/40 to-fuchsia-100/40 rounded-full blur-3xl -z-10 pointer-events-none group-hover:scale-125 transition-transform duration-1000"></div>
                    
                    <div className="text-center mb-4">
                        <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center text-4xl shadow-[0_8px_16px_-4px_rgba(0,0,0,0.05)] border border-white ring-2 ring-violet-100 mb-3">
                            🧙‍♂️
                        </div>
                        <div className="text-xs font-extrabold uppercase tracking-widest text-violet-500 mb-1">当前角色</div>
                        <h3 className="text-xl font-black text-stone-800">{rpgStats.title}</h3>
                        <div className="text-xs font-bold text-white bg-gradient-to-r from-violet-400 to-fuchsia-400 px-3 py-1 rounded-full inline-block mt-2">
                            Lv.{rpgStats.level}
                        </div>
                    </div>

                    {/* Mini Stats */}
                    <div className="space-y-2 mb-4">
                        {[
                            { label: "代码力", val: rpgStats.strength, color: "bg-emerald-400" },
                            { label: "沟通力", val: rpgStats.charisma, color: "bg-amber-400" },
                            { label: "专注度", val: rpgStats.wisdom, color: "bg-sky-400" },
                            { label: "摸鱼值", val: rpgStats.chaos, color: "bg-rose-400" }
                        ].map(stat => (
                            <div key={stat.label} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-stone-500 w-12">{stat.label}</span>
                                <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${stat.color} transition-all duration-1000`}
                                        style={{ width: `${stat.val}%` }}
                                    ></div>
                                </div>
                                <span className="text-[10px] font-bold text-stone-400 w-6 text-right">{stat.val}</span>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={onOpenRPGDetail}
                        className="w-full group/btn relative overflow-hidden rounded-xl bg-white border border-violet-100 p-2.5 hover:border-violet-200 hover:shadow-md hover:shadow-violet-100 transition-all"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-50 to-fuchsia-50 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                        <span className="relative text-xs font-bold text-violet-600 flex items-center justify-center gap-2">
                            ✨ 查看详细装备
                        </span>
                    </button>
                </div>

                {/* Daily Report Compact */}
                <div className="glass p-6 rounded-3xl border border-white/60 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-stone-700 flex items-center gap-2 text-sm">
                                <FileTextIcon className="w-4 h-4 text-stone-400"/>
                                自动日报
                            </h3>
                            <button
                                onClick={() => setShowSettings(true)}
                                className="text-xs text-stone-400 hover:text-blue-500 transition-colors"
                                title="配置筛选策略"
                            >
                                ⚙️
                            </button>
                            {/* 版本切换标签 */}
                            <div className="flex items-center gap-1 ml-2 bg-white/50 rounded-lg p-1">
                                <button
                                    onClick={() => setCurrentVersion('self')}
                                    className={`text-xs font-bold px-2 py-1 rounded transition-colors ${
                                        currentVersion === 'self'
                                            ? 'bg-blue-500 text-white'
                                            : 'text-stone-500 hover:text-stone-700'
                                    }`}
                                >
                                    详细版
                                </button>
                                <button
                                    onClick={() => setCurrentVersion('leader')}
                                    className={`text-xs font-bold px-2 py-1 rounded transition-colors ${
                                        currentVersion === 'leader'
                                            ? 'bg-amber-500 text-white'
                                            : 'text-stone-500 hover:text-stone-700'
                                    }`}
                                    title={!leaderReport ? '还未生成汇报版，点击切换后可以编辑提示词和生成' : '切换到汇报版'}
                                >
                                    👔 汇报版
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* 详细版按钮 */}
                            {!editingDaily && !editingLeader && currentVersion === 'self' && (
                                <>
                                    <button 
                                        onClick={handleEditDaily}
                                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors text-blue-600 bg-blue-50 hover:bg-blue-100"
                                    >
                                        ✏️ 编辑
                                    </button>
                                    <button 
                                        onClick={() => handleCopyToClipboard(dailyReport, 'daily')}
                                        className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
                                            copiedDaily 
                                                ? 'text-emerald-700 bg-emerald-100' 
                                                : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                        }`}
                                    >
                                        <CopyIcon className="w-3 h-3" />
                                        {copiedDaily ? '已复制!' : '复制'}
                                    </button>
                                </>
                            )}
                            {/* 汇报版按钮 */}
                            {!editingDaily && !editingLeader && currentVersion === 'leader' && leaderReport && (
                                <>
                                    <button 
                                        onClick={handleEditLeader}
                                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors text-amber-600 bg-amber-50 hover:bg-amber-100"
                                    >
                                        ✏️ 编辑
                                    </button>
                                    <button 
                                        onClick={() => handleCopyToClipboard(leaderReport, 'daily')}
                                        className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
                                            copiedDaily 
                                                ? 'text-emerald-700 bg-emerald-100' 
                                                : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                        }`}
                                    >
                                        <CopyIcon className="w-3 h-3" />
                                        {copiedDaily ? '已复制!' : '复制'}
                                    </button>
                                </>
                            )}
                            {/* 详细版编辑中 */}
                            {editingDaily && (
                                <>
                                    <button 
                                        onClick={handleCancelEdit}
                                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors text-stone-600 bg-stone-50 hover:bg-stone-100"
                                    >
                                        ✖️ 取消
                                    </button>
                                    <button 
                                        onClick={handleSaveDaily}
                                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                    >
                                        💾 保存
                                    </button>
                                </>
                            )}
                            {/* 汇报版编辑中 */}
                            {editingLeader && (
                                <>
                                    <button 
                                        onClick={handleCancelEditLeader}
                                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors text-stone-600 bg-stone-50 hover:bg-stone-100"
                                    >
                                        ✖️ 取消
                                    </button>
                                    <button 
                                        onClick={handleSaveLeader}
                                        className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                    >
                                        💾 保存
                                    </button>
                                </>
                            )}
                        </div>
                     </div>
                     
                    <div className="flex-1 bg-white/50 rounded-xl p-4 border border-stone-100 overflow-y-auto max-h-64 text-xs text-stone-600 leading-relaxed shadow-inner">
                        {/* 详细版 - 编辑模式 */}
                        {editingDaily && currentVersion === 'self' ? (
                            <textarea
                                value={editedDailyContent}
                                onChange={(e) => setEditedDailyContent(e.target.value)}
                                className="w-full h-full min-h-[200px] bg-transparent border-none outline-none resize-none font-mono text-xs"
                                placeholder="编辑详细版日报内容..."
                            />
                        ) : /* 详细版 - 查看模式 */ currentVersion === 'self' ? (
                            <div className="prose prose-xs prose-stone max-w-none">
                                <ReactMarkdown>{dailyReport}</ReactMarkdown>
                            </div>
                        ) : /* 汇报版 - 编辑模式 */ editingLeader ? (
                            <textarea
                                value={editedLeaderContent}
                                onChange={(e) => setEditedLeaderContent(e.target.value)}
                                className="w-full h-full min-h-[200px] bg-transparent border-none outline-none resize-none font-mono text-xs"
                                placeholder="编辑汇报版日报内容..."
                            />
                        ) : /* 汇报版 - 查看模式 */ leaderReport ? (
                            <div className="prose prose-xs prose-stone max-w-none">
                                <ReactMarkdown>{leaderReport}</ReactMarkdown>
                            </div>
                        ) : /* 汇报版 - 未生成 */ (
                            <div className="flex flex-col items-center justify-center h-full text-center py-8">
                                <div className="text-4xl mb-3">👔</div>
                                <p className="text-sm text-stone-500 mb-4">还没有生成汇报版日报</p>
                                <button
                                    onClick={handleGenerateLeaderReport}
                                    disabled={generatingLeader || !dailyReport || dailyReport === mockDailyReport}
                                    className="text-xs font-bold px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <SparklesIcon className="w-3 h-3" />
                                    {generatingLeader ? '生成中...' : '生成汇报版'}
                                </button>
                            </div>
                        )}
                     </div>
                     
                    <div className="mt-3 flex items-center justify-between">
                        {currentVersion === 'self' ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleGenerateDailyReport}
                                        disabled={generatingDaily || editingDaily || editingLeader}
                                        className="text-xs font-bold text-stone-400 hover:text-rose-500 flex items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <SparklesIcon className="w-3 h-3" />
                                        {generatingDaily ? '生成中...' : '重新生成'}
                                    </button>
                                    <button 
                                        onClick={() => handleOpenPromptEditor('daily_detailed')}
                                        className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                                        title="自定义提示词"
                                    >
                                        ⚙️ 编辑提示词
                                    </button>
                                </div>
                                <button 
                                    onClick={handleGenerateLeaderReport}
                                    disabled={generatingLeader || editingDaily || editingLeader || !dailyReport || dailyReport === mockDailyReport}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 flex items-center gap-1"
                                >
                                    {generatingLeader ? '生成中...' : '👔 生成汇报版'}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleGenerateLeaderReport}
                                        disabled={generatingLeader || editingDaily || editingLeader || !dailyReport || dailyReport === mockDailyReport}
                                        className="text-xs font-bold text-stone-400 hover:text-amber-500 flex items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <SparklesIcon className="w-3 h-3" />
                                        {generatingLeader ? '重新生成中...' : '重新生成'}
                                    </button>
                                    <button 
                                        onClick={() => handleOpenPromptEditor('daily_leader')}
                                        className="text-xs font-semibold text-amber-500 hover:text-amber-600 flex items-center gap-1 transition-colors"
                                        title="自定义提示词"
                                    >
                                        ⚙️ 编辑提示词
                                    </button>
                                </div>
                                <button 
                                    onClick={handleClickPush}
                                    disabled={pushingDaily || editingDaily || editingLeader || !leaderReport}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 flex items-center gap-1"
                                >
                                    {pushingDaily ? '推送中...' : '📤 推送到 GitHub'}
                                </button>
                            </>
                        )}
                     </div>
                </div>

                {/* Weekly Report Compact */}
                <div className="glass p-6 rounded-3xl border border-white/60 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-stone-700 flex items-center gap-2 text-sm">
                            <ChartPieIcon className="w-4 h-4 text-stone-400"/>
                            自动周报
                        </h3>
                        <button 
                            onClick={() => handleCopyToClipboard(weeklyReport, 'weekly')}
                            className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
                                copiedWeekly 
                                    ? 'text-violet-700 bg-violet-100' 
                                    : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                            }`}
                        >
                            <CopyIcon className="w-3 h-3" />
                            {copiedWeekly ? '已复制!' : '复制'}
                        </button>
                     </div>

                    {/* 生成方式选择 */}
                    <div className="mb-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-stone-500">生成方式：</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setWeeklyGenMethod('from_daily')}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                        weeklyGenMethod === 'from_daily'
                                            ? 'bg-violet-500 text-white shadow-md'
                                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                    }`}
                                >
                                    📄 根据日报生成
                                </button>
                                <button
                                    onClick={() => setWeeklyGenMethod('from_raw')}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                        weeklyGenMethod === 'from_raw'
                                            ? 'bg-violet-500 text-white shadow-md'
                                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                    }`}
                                >
                                    🔍 根据原始数据生成
                                </button>
                            </div>
                        </div>

                        {/* 如果选择从日报生成，显示日报版本选择 */}
                        {weeklyGenMethod === 'from_daily' && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-stone-500">日报版本：</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setWeeklyDailyVersion('detailed')}
                                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                            weeklyDailyVersion === 'detailed'
                                                ? 'bg-blue-500 text-white shadow-md'
                                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                        }`}
                                    >
                                        📝 详细版
                                    </button>
                                    <button
                                        onClick={() => setWeeklyDailyVersion('leader')}
                                        className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                            weeklyDailyVersion === 'leader'
                                                ? 'bg-amber-500 text-white shadow-md'
                                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                        }`}
                                    >
                                        📋 汇报版
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 提示信息 */}
                        <div className="text-xs text-stone-400 bg-stone-50 rounded-lg p-2">
                            {weeklyGenMethod === 'from_daily' ? (
                                <>
                                    💡 <strong>根据日报生成：</strong>汇总本周每天的{weeklyDailyVersion === 'detailed' ? '详细版' : '汇报版'}日报，内容更完整不易丢失信息
                                </>
                            ) : (
                                <>
                                    💡 <strong>根据原始数据生成：</strong>直接分析本周屏幕活动数据，更灵活但受数据量限制
                                </>
                            )}
                        </div>
                    </div>
                     
                    <div className="flex-1 bg-white/50 rounded-xl p-4 border border-stone-100 overflow-y-auto max-h-64 text-xs text-stone-600 leading-relaxed shadow-inner">
                        <div className="prose prose-xs prose-stone max-w-none">
                            <ReactMarkdown>{weeklyReport}</ReactMarkdown>
                        </div>
                     </div>
                     
                    <div className="mt-3 flex items-center justify-center gap-2">
                        <button 
                            onClick={handleGenerateWeeklyReport}
                            disabled={generatingWeekly}
                            className="text-xs font-bold text-stone-400 hover:text-violet-500 flex items-center justify-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <SparklesIcon className="w-3 h-3" />
                            {generatingWeekly ? '生成中...' : '重新生成'}
                        </button>
                        <button 
                            onClick={() => handleOpenPromptEditor(weeklyGenMethod === 'from_daily' ? 'weekly_from_daily' : 'weekly_from_raw')}
                            className="text-xs font-semibold text-violet-500 hover:text-violet-600 flex items-center gap-1 transition-colors"
                            title={`自定义提示词（${weeklyGenMethod === 'from_daily' ? '从日报生成' : '从原始数据生成'}）`}
                        >
                            ⚙️ 编辑提示词
                        </button>
                     </div>
                </div>
            </div>

            {/* 报告设置模态框 */}
            <ReportSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                settings={reportSettings}
                onSave={handleSaveSettings}
                availableApps={availableApps}
            />

            {/* 覆盖确认对话框 */}
            <ConfirmDialog
                isOpen={showOverwriteConfirm}
                title="⚠️ 覆盖确认"
                message={`检测到已有保存的${pendingReport?.type === 'daily' ? '日报' : '周报'}，是否要用新生成的内容覆盖？\n\n点击"确认"将覆盖原有内容\n点击"取消"将保留原有内容`}
                confirmText="确认覆盖"
                cancelText="保留原有"
                onConfirm={() => handleConfirmOverwrite(true)}
                onCancel={() => handleConfirmOverwrite(false)}
            />

            {/* PAT 输入模态框 */}
            <PatInputModal
                isOpen={showPatInput}
                onConfirm={handleConfirmPush}
                onCancel={handleCancelPush}
            />

            {/* 提示词编辑器 */}
            <PromptEditorModal
                isOpen={showPromptEditor}
                title={`自定义提示词 - ${
                    editingPromptType === 'daily_detailed' ? '日报（详细版）' :
                    editingPromptType === 'daily_leader' ? '日报（汇报版）' :
                    editingPromptType === 'weekly_from_daily' ? '周报（从日报生成）' :
                    '周报（从原始数据生成）'
                }`}
                promptType={editingPromptType}
                defaultPrompt={DEFAULT_PROMPTS[editingPromptType]}
                currentPrompt={getCurrentPrompt(editingPromptType)}
                availableVariables={getPromptVariables(editingPromptType)}
                onSave={handleSavePrompt}
                onClose={() => setShowPromptEditor(false)}
            />
        </div>
    );
};
