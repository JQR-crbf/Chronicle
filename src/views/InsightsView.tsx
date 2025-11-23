import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
import { mockDailyReport, mockWeeklyReport } from '../constants';
import { EyeIcon, FileTextIcon, ChartPieIcon, CopyIcon, SparklesIcon, ClockIcon, CalendarIcon } from '../components/icons';
import { getEventsByDateRange } from '../utils/screenpipe';
import { 
    analyzeTodayEvents, 
    calculateRPGStats, 
    getWeekEvents
} from '../utils/insightsAnalyzer';
import { analyzeTaskStats, convertToChartHeights } from '../utils/taskAnalyzer';
import { filterEvents, type FilterStrategy } from '../utils/reportFilters';
import { ReportSettingsModal, type ReportSettings } from '../components/modals/ReportSettingsModal';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import type { TodayOverview, TimeDistribution, AppUsage, FocusPeriod, RPGStats } from '../utils/insightsAnalyzer';
import type { TaskStats } from '../utils/taskAnalyzer';
import type { ScreenpipeEvent } from '../types';

interface InsightsViewProps {
  onOpenRPGDetail: () => void;
}

export const InsightsView = ({ onOpenRPGDetail }: InsightsViewProps) => {
    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
    
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
    const [dailyReport, setDailyReport] = useState(() => {
        // 优先从 localStorage 读取保存的日报
        const saved = localStorage.getItem(`dailyReport_${selectedDate}`);
        return saved || mockDailyReport;
    });
    const [weeklyReport, setWeeklyReport] = useState(() => {
        // 优先从 localStorage 读取保存的周报
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        const weekKey = weekStart.toISOString().split('T')[0];
        const saved = localStorage.getItem(`weeklyReport_${weekKey}`);
        return saved || mockWeeklyReport;
    });
    const [generatingDaily, setGeneratingDaily] = useState(false);
    const [generatingWeekly, setGeneratingWeekly] = useState(false);
    const [copiedDaily, setCopiedDaily] = useState(false);
    const [copiedWeekly, setCopiedWeekly] = useState(false);
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
    const [pendingReport, setPendingReport] = useState<{ type: 'daily' | 'weekly', content: string } | null>(null);
    
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

    // 加载数据
    useEffect(() => {
        loadDailyData(selectedDate);
        
        // 加载该日期的日报（如果有）
        const savedDaily = localStorage.getItem(`dailyReport_${selectedDate}`);
        if (savedDaily) {
            setDailyReport(savedDaily);
            console.log('📖 [日报] 从 localStorage 加载:', selectedDate);
        } else {
            setDailyReport(mockDailyReport);
        }
        
        // 如果是今天，每5分钟刷新一次
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        if (selectedDate === todayStr) {
            const interval = setInterval(() => loadDailyData(selectedDate), 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [selectedDate]);

    // 保存报告设置
    const handleSaveSettings = (settings: ReportSettings) => {
        setReportSettings(settings);
        localStorage.setItem('reportSettings', JSON.stringify(settings));
        console.log('💾 [设置] 已保存:', settings);
    };

    // 保存日报到 localStorage
    const saveDailyReport = (content: string, date: string) => {
        localStorage.setItem(`dailyReport_${date}`, content);
        console.log('💾 [日报] 已保存到 localStorage:', date);
    };

    // 保存周报到 localStorage
    const saveWeeklyReport = (content: string) => {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        const weekKey = weekStart.toISOString().split('T')[0];
        localStorage.setItem(`weeklyReport_${weekKey}`, content);
        console.log('💾 [周报] 已保存到 localStorage:', weekKey);
    };

    // 检查是否有已保存的报告
    const hasExistingDailyReport = (date: string): boolean => {
        const saved = localStorage.getItem(`dailyReport_${date}`);
        return !!(saved && saved !== mockDailyReport);
    };

    const hasExistingWeeklyReport = (): boolean => {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
        const weekKey = weekStart.toISOString().split('T')[0];
        const saved = localStorage.getItem(`weeklyReport_${weekKey}`);
        return !!(saved && saved !== mockWeeklyReport);
    };

    // 确认覆盖
    const handleConfirmOverwrite = (confirm: boolean) => {
        if (confirm && pendingReport) {
            if (pendingReport.type === 'daily') {
                setDailyReport(pendingReport.content);
                saveDailyReport(pendingReport.content, selectedDate);
            } else {
                setWeeklyReport(pendingReport.content);
                saveWeeklyReport(pendingReport.content);
            }
        }
        setShowOverwriteConfirm(false);
        setPendingReport(null);
    };

    const loadDailyData = async (date: string) => {
        try {
            setLoading(true);
            // 使用 getEventsByDateRange 获取指定日期全天的数据
            const events = await getEventsByDateRange(date);
            setTodayEvents(events);
            
            if (events.length > 0) {
                const analysis = analyzeTodayEvents(events);
                setOverview(analysis.overview);
                setTimeDistribution(analysis.timeDistribution);
                setAppUsage(analysis.appUsage);
                setFocusPeriods(analysis.focusPeriods);
                
                // 计算RPG属性
                const stats = calculateRPGStats(events);
                setRpgStats(stats);
            } else {
                // Reset stats if no data
                setOverview({ workHours: 0, deepWorkHours: 0, tasksCompleted: 0, focusScore: 0 });
                setTimeDistribution({
                    deepWork: { hours: 0, percent: 0 },
                    communication: { hours: 0, percent: 0 },
                    leisure: { hours: 0, percent: 0 }
                });
                setAppUsage([]);
                setFocusPeriods([]);
            }
            
            // 获取任务统计（独立于events数据，目前还是全局统计，暂时保持不变）
            // TODO: 如果任务统计也需要支持历史日期，需要修改 taskAnalyzer
            const taskAnalysis = analyzeTaskStats();
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
            console.log('🔵 [日报] API Key 存在:', !!process.env.API_KEY);
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

            // 3. 调用 Gemini 生成报告
            console.log('🔵 [日报] 开始调用 Gemini API...');
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `
你是一个专业的工作日报生成助手。

根据用户 ${selectedDate} 的屏幕活动日志，生成一份结构化的工作日报。

要求：
1. 使用 Markdown 格式
2. 包含以下部分：
   - 📅 日报 (${selectedDate})
   - 🚀 开发进度
   - 💬 沟通与会议
   - 📚 调研
3. 过滤掉娱乐和摸鱼内容
4. 突出重要成果和数据
5. 语言简洁专业

活动日志：
${JSON.stringify(summary, null, 2)}
                `
            });

            console.log('✅ [日报] Gemini API 调用成功');
            console.log('✅ [日报] 生成的报告（前200字符）:', response.text.substring(0, 200));
            
            // 检查是否已有保存的报告
            if (hasExistingDailyReport(selectedDate)) {
                // 有已保存的报告，询问是否覆盖
                console.log('⚠️ [日报] 发现已保存的报告，询问是否覆盖');
                setPendingReport({ type: 'daily', content: response.text });
                setShowOverwriteConfirm(true);
            } else {
                // 没有已保存的报告，直接保存
                setDailyReport(response.text);
                saveDailyReport(response.text, selectedDate);
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

    const handleGenerateWeeklyReport = async () => {
        console.log('🟣 [周报] 点击了重新生成按钮');
        
        setGeneratingWeekly(true);
        
        try {
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
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
            weekStart.setHours(0, 0, 0, 0);
            
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
            
            // 5. 调用 Gemini 生成周报
            const today = new Date();
            const weekStartDate = new Date(weekStart);
            
            console.log('🟣 [周报] 开始调用 Gemini API...');
            console.log('🟣 [周报] 日期范围:', weekStartDate.toLocaleDateString('zh-CN'), '~', today.toLocaleDateString('zh-CN'));
            console.log('🟣 [周报] 工作时长:', weekAnalysis.overview.workHours.toFixed(1), '小时');
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `
你是一个专业的工作周报生成助手。

根据用户本周的屏幕活动数据，生成一份结构化的工作周报。

要求：
1. 使用 Markdown 格式
2. 包含以下部分：
   - 🗓️ 周报 (${weekStartDate.toLocaleDateString('zh-CN')} ~ ${today.toLocaleDateString('zh-CN')})
   - 🌟 本周亮点
   - 📊 数据统计
   - 🚧 改进建议
   - 📈 下周计划
3. 基于数据提供洞察，而不是简单罗列
4. 语言简洁专业

本周统计数据：
- 总工作时长：${weekAnalysis.overview.workHours.toFixed(1)} 小时
- 深度工作时长：${weekAnalysis.overview.deepWorkHours.toFixed(1)} 小时
- 专注度评分：${weekAnalysis.overview.focusScore}
- 深度工作占比：${weekAnalysis.timeDistribution.deepWork.percent}%
- 会议沟通占比：${weekAnalysis.timeDistribution.communication.percent}%
- 主要应用：${weekAnalysis.appUsage.map(a => a.appName).join(', ')}

每日概况：
${dailySummaries.map(d => `- ${d.date}: 工作 ${d.workHours.toFixed(1)}h, 深度工作 ${d.deepWorkHours.toFixed(1)}h, 主要: ${d.topApps}`).join('\n')}
                `
            });

            console.log('✅ [周报] Gemini API 调用成功');
            console.log('✅ [周报] 生成的报告（前200字符）:', response.text.substring(0, 200));
            
            // 检查是否已有保存的报告
            if (hasExistingWeeklyReport()) {
                // 有已保存的报告，询问是否覆盖
                console.log('⚠️ [周报] 发现已保存的报告，询问是否覆盖');
                setPendingReport({ type: 'weekly', content: response.text });
                setShowOverwriteConfirm(true);
            } else {
                // 没有已保存的报告，直接保存
                setWeeklyReport(response.text);
                saveWeeklyReport(response.text);
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
                    
                    <h3 className="font-bold text-stone-700 mb-6 flex items-center gap-2 text-lg">
                        <SparklesIcon className="w-5 h-5 text-violet-500"/>
                        效率分析与建议
                    </h3>

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
                        </div>
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
                     </div>
                     
                    <div className="flex-1 bg-white/50 rounded-xl p-4 border border-stone-100 overflow-y-auto max-h-64 text-xs text-stone-600 leading-relaxed shadow-inner">
                        <div className="prose prose-xs prose-stone max-w-none">
                            <ReactMarkdown>{dailyReport}</ReactMarkdown>
                        </div>
                     </div>
                     
                    <div className="mt-3 text-center">
                        <button 
                            onClick={handleGenerateDailyReport}
                            disabled={generatingDaily}
                            className="text-xs font-bold text-stone-400 hover:text-rose-500 flex items-center justify-center gap-1 mx-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <SparklesIcon className="w-3 h-3" />
                            {generatingDaily ? '生成中...' : '重新生成'}
                        </button>
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
                     
                    <div className="flex-1 bg-white/50 rounded-xl p-4 border border-stone-100 overflow-y-auto max-h-64 text-xs text-stone-600 leading-relaxed shadow-inner">
                        <div className="prose prose-xs prose-stone max-w-none">
                            <ReactMarkdown>{weeklyReport}</ReactMarkdown>
                        </div>
                     </div>
                     
                    <div className="mt-3 text-center">
                        <button 
                            onClick={handleGenerateWeeklyReport}
                            disabled={generatingWeekly}
                            className="text-xs font-bold text-stone-400 hover:text-violet-500 flex items-center justify-center gap-1 mx-auto transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <SparklesIcon className="w-3 h-3" />
                            {generatingWeekly ? '生成中...' : '重新生成'}
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
        </div>
    );
};
