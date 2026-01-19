import React, { useState, useEffect, useMemo } from 'react';
import { ScreenpipeEvent, AIAnalysis, AIClient } from '../types';
import { mockTimelineEvents } from '../constants';
import { LaptopIcon } from '../components/icons';
import { getEventsByDateRange, checkScreenpipeStatus, getUniqueAppNames } from '../utils/screenpipe';
import { EventDetailModal } from '../components/modals/EventDetailModal';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { AlertDialog } from '../components/modals/AlertDialog';
import { MergeSettingsModal } from '../components/modals/MergeSettingsModal';
import { 
  analyzeEventsInBatch, 
  loadAIAnalysisFromStorage, 
  saveAIAnalysisToStorage,
  mergeEventsWithAnalysis
} from '../utils/aiAnalyzer';
import {
  MergedEvent,
  mergeEvents,
  loadMergeSettings,
  saveMergeSettings,
  cacheMergedEvents,
  loadCachedMergedEvents,
} from '../utils/contentMerger';
import { invoke } from '@tauri-apps/api/core';

interface TimelineViewProps {
  ai: AIClient | null;
  modelName: string;
}

export const TimelineView = ({ ai, modelName }: TimelineViewProps) => {
  const [events, setEvents] = useState<MergedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [originalEventCount, setOriginalEventCount] = useState(0); // 原始记录数（合并前）
  const [apiReturnedCount, setApiReturnedCount] = useState(0); // API返回的总记录数
  const [afterFilterCount, setAfterFilterCount] = useState(0); // 空内容过滤后的记录数
  
  // 筛选状态
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [startHour, setStartHour] = useState<number>(10); // 默认早上10点
  const [endHour, setEndHour] = useState<number>(20); // 默认晚上8点
  const [selectedApp, setSelectedApp] = useState<string>(''); // 空字符串表示全部
  const [availableApps, setAvailableApps] = useState<string[]>([]);

  // 弹窗状态
  const [selectedEvent, setSelectedEvent] = useState<ScreenpipeEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMergeSettingsOpen, setIsMergeSettingsOpen] = useState(false);

  // 对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // AI 分析状态
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [aiAnalyses, setAiAnalyses] = useState<Map<string, AIAnalysis>>(new Map());

  // 合并功能状态
  const [mergeEnabled, setMergeEnabled] = useState(() => loadMergeSettings().enabled);
  const [mergeSettings, setMergeSettings] = useState(() => loadMergeSettings());

  // 排序状态：'asc' 正序（旧到新）, 'desc' 倒序（新到旧）
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 排序后的事件列表
  const sortedEvents = useMemo(() => {
    const sorted = [...events];
    sorted.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });
    return sorted;
  }, [events, sortOrder]);

  const loadEvents = async () => {
    setLoading(true);
    
    // 检查 Screenpipe 是否运行
    const connected = await checkScreenpipeStatus();
    setIsConnected(connected);

    if (connected) {
      try {
        // 🔍 调试：打印查询参数
        console.log('🔍 查询参数:', {
          selectedDate,
          startHour,
          endHour,
          selectedApp: selectedApp || 'all',
          queryKey: `${selectedDate}-${startHour}-${endHour}-${selectedApp || 'all'}`
        });

        // 使用真实数据，根据筛选条件
        // 直接传递日期字符串，避免时区转换问题
        const realEvents = await getEventsByDateRange(
          selectedDate, // 直接使用字符串 "YYYY-MM-DD"
          startHour,
          endHour,
          selectedApp || undefined // 如果为空则不筛选应用
        );
        
        // 📊 记录 API 返回的总记录数
        console.log('📊 API 返回记录数:', realEvents.length);
        setApiReturnedCount(realEvents.length);
        
        // 合并 AI 分析结果
        let eventsWithAnalysis = mergeEventsWithAnalysis(realEvents, aiAnalyses);

        // 🚫 过滤掉空内容的事件（不论是否启用合并）
        const beforeFilter = eventsWithAnalysis.length;
        eventsWithAnalysis = eventsWithAnalysis.filter(event => {
          const hasContent = event.content && event.content.trim().length > 0;
          if (!hasContent) {
            console.log('🗑️ 过滤掉空内容事件:', {
              id: event.id,
              app: event.appName,
              timestamp: event.timestamp
            });
          }
          return hasContent;
        });
        console.log(`📊 空内容过滤: ${beforeFilter} → ${eventsWithAnalysis.length} 条记录`);
        
        // ✅ 记录过滤后的记录数
        setAfterFilterCount(eventsWithAnalysis.length);
        setOriginalEventCount(eventsWithAnalysis.length);

        // 如果启用了内容合并功能
        if (mergeEnabled && eventsWithAnalysis.length > 0) {
          console.log('🔀 启用内容合并功能');
          
          // 生成缓存键
          const cacheKey = `${selectedDate}-${startHour}-${endHour}-${selectedApp || 'all'}`;
          console.log('🔑 缓存键:', cacheKey);
          
          // 尝试从缓存加载
          let mergedEvents = loadCachedMergedEvents(cacheKey);
          
          if (!mergedEvents) {
            // 缓存未命中，执行合并
            console.log('📦 缓存未命中，开始合并...');
            mergedEvents = mergeEvents(eventsWithAnalysis, {
              similarityThreshold: mergeSettings.similarityThreshold,
              timeWindowMinutes: mergeSettings.timeWindowMinutes,
            });
            
            console.log('✅ 合并完成:', {
              输入: eventsWithAnalysis.length,
              输出: mergedEvents.length,
              减少: eventsWithAnalysis.length - mergedEvents.length
            });
            
            // 缓存结果
            cacheMergedEvents(cacheKey, mergedEvents);
          } else {
            console.log('💾 使用缓存数据:', {
              缓存键: cacheKey,
              记录数: mergedEvents.length
            });
          }
          
          setEvents(mergedEvents);
        } else {
          // 不合并，直接使用
          // 将普通事件转换为 MergedEvent 格式（兼容）
          const asMergedEvents: MergedEvent[] = eventsWithAnalysis.map(e => ({
            ...e,
            mergedCount: 1,
            originalEvents: [e],
            timeRange: {
              start: e.timestamp,
              end: e.timestamp,
            },
          }));
          setEvents(asMergedEvents);
        }
        
        // 加载可用的应用列表（用于筛选）
        if (availableApps.length === 0) {
          // 为查询应用列表创建本地时间的日期对象
          const [year, month, day] = selectedDate.split('-').map(Number);
          const dateStart = new Date(year, month - 1, day, 0, 0, 0);
          const dateEnd = new Date(year, month - 1, day, 23, 59, 59);
          const apps = await getUniqueAppNames(dateStart, dateEnd);
          setAvailableApps(apps);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        setEvents([]);
      }
    } else {
      // 降级到 Mock 数据
      console.log('Screenpipe 未连接，使用演示数据');
      const mockAsMerged: MergedEvent[] = mockTimelineEvents.map(e => ({
        ...e,
        mergedCount: 1,
        originalEvents: [e],
        timeRange: {
          start: e.timestamp,
          end: e.timestamp,
        },
      }));
      setEvents(mockAsMerged);
      setApiReturnedCount(mockTimelineEvents.length);
      setAfterFilterCount(mockTimelineEvents.length);
      setOriginalEventCount(mockTimelineEvents.length);
    }
    
    setLoading(false);
  };

  // 加载 AI 分析数据
  useEffect(() => {
    const savedAnalyses = loadAIAnalysisFromStorage();
    setAiAnalyses(savedAnalyses);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [selectedDate, startHour, endHour, selectedApp, aiAnalyses, mergeEnabled, mergeSettings]); // 筛选条件、AI分析或合并设置变化时重新加载

  // 手动刷新
  const handleRefresh = () => {
    loadEvents();
  };

  // 清理旧视频
  const [isCleaning, setIsCleaning] = useState(false);
  
  const handleCleanVideos = () => {
    setConfirmDialog({
      isOpen: true,
      title: '🗑️ 清理旧视频',
      message: '确定要删除 1 天前的视频文件吗？\n\n⚠️ 注意：\n• 这将永久删除旧的视频文件\n• OCR 提取的文字数据会保留\n• 不会影响时间线和洞察功能\n• 可以释放磁盘空间',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setIsCleaning(true);
        
        try {
          const result = await invoke<string>('clean_old_videos', { daysOld: 1 });
          
          setAlertDialog({
            isOpen: true,
            title: '✅ 清理完成',
            message: result,
            type: 'success',
          });
        } catch (error) {
          setAlertDialog({
            isOpen: true,
            title: '❌ 清理失败',
            message: error as string,
            type: 'error',
          });
        } finally {
          setIsCleaning(false);
        }
      },
    });
  };

  // 清除所有缓存
  const handleClearCache = () => {
    try {
      // 清除合并缓存
      localStorage.removeItem('screenpipe_merged_cache');
      console.log('🗑️ 已清除合并缓存');
      
      setAlertDialog({
        isOpen: true,
        title: '缓存已清除',
        message: '所有合并缓存已清除，页面将刷新以重新加载数据',
        type: 'success',
      });
      
      // 1秒后刷新
      setTimeout(() => {
        setAlertDialog({ ...alertDialog, isOpen: false });
        loadEvents();
      }, 1000);
    } catch (error) {
      console.error('清除缓存失败:', error);
      setAlertDialog({
        isOpen: true,
        title: '清除缓存失败',
        message: String(error),
        type: 'error',
      });
    }
  };

  // 切换合并功能
  const handleToggleMerge = (enabled: boolean) => {
    setMergeEnabled(enabled);
    const newSettings = { ...mergeSettings, enabled };
    setMergeSettings(newSettings);
    saveMergeSettings(newSettings);
    console.log('🔀 合并功能:', enabled ? '已启用' : '已禁用');
  };

  // 保存合并设置
  const handleSaveMergeSettings = (newSettings: { similarityThreshold: number; timeWindowMinutes: number }) => {
    const updatedSettings = { ...mergeSettings, ...newSettings };
    setMergeSettings(updatedSettings);
    saveMergeSettings(updatedSettings);
    console.log('💾 已保存合并设置:', updatedSettings);
    
    // ✅ 清除所有合并缓存（设置变更后必须重新合并）
    try {
      localStorage.removeItem('screenpipe_merged_cache');
      console.log('🗑️ 已清除所有合并缓存（因设置变更）');
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
    
    // 显示成功提示
    setAlertDialog({
      isOpen: true,
      title: '设置已保存',
      message: `相似度阈值: ${Math.round(newSettings.similarityThreshold * 100)}%\n时间窗口: ${newSettings.timeWindowMinutes} 分钟\n\n缓存已清除，页面将刷新以应用新设置`,
      type: 'success',
    });
    
    // 1秒后刷新数据
    setTimeout(() => {
      setAlertDialog({ ...alertDialog, isOpen: false });
      loadEvents();
    }, 1500);
  };

  // 打开事件详情
  const handleOpenEventDetail = (event: ScreenpipeEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  // 处理单条分析完成
  const handleSingleAnalysisComplete = (eventId: string, analysis: AIAnalysis) => {
    console.log('✅ 单条分析完成:', { eventId, analysis });
    
    // 更新 aiAnalyses Map
    const updatedAnalyses = new Map(aiAnalyses);
    updatedAnalyses.set(eventId, analysis);
    setAiAnalyses(updatedAnalyses);
    
    // 保存到 localStorage
    saveAIAnalysisToStorage(updatedAnalyses);
    console.log('💾 已保存 AI 分析结果到 localStorage');
    
    // 清除当前查询的合并缓存（重要！）
    // 因为缓存中的数据不包含新的 AI 分析结果
    if (mergeEnabled) {
      const cacheKey = `${selectedDate}-${startHour}-${endHour}-${selectedApp || 'all'}`;
      const cache = JSON.parse(localStorage.getItem('screenpipe_merged_cache') || '{}');
      if (cache[cacheKey]) {
        delete cache[cacheKey];
        localStorage.setItem('screenpipe_merged_cache', JSON.stringify(cache));
        console.log('🗑️ 已清除过期的合并缓存:', cacheKey);
      }
    }
    
    // 更新事件列表
    const updatedEvents = events.map(e => 
      e.id === eventId ? { ...e, aiAnalysis: analysis } : e
    );
    setEvents(updatedEvents);
    
    console.log('✅ 单条分析结果处理完成');
  };

  // AI 分析当前显示的事件
  const handleAIAnalyze = () => {
    console.log('🚀 开始 AI 分析...', { eventCount: events.length });

    if (events.length === 0) {
      setAlertDialog({
        isOpen: true,
        title: '没有可分析的事件',
        message: '请先选择日期和时间范围，确保有数据显示。',
        type: 'error',
      });
      return;
    }

    if (!ai) {
      setAlertDialog({
        isOpen: true,
        title: '未配置 AI',
        message: '请在设置中配置 AI API Key',
        type: 'error',
      });
      console.error('AI 未配置');
      return;
    }

    // 统计需要分析的数量
    const needAnalysis = events.filter(e => !e.aiAnalysis).length;
    const alreadyAnalyzed = events.length - needAnalysis;

    console.log('📊 分析统计:', { 
      total: events.length, 
      needAnalysis, 
      alreadyAnalyzed 
    });

    if (needAnalysis === 0) {
      setAlertDialog({
        isOpen: true,
        title: '所有记录都已分析完成',
        message: `共 ${events.length} 条记录\n\n如需重新分析，请清除浏览器 localStorage`,
        type: 'info',
      });
      return;
    }

    const confirmMessage = 
      `总共: ${events.length} 条记录\n` +
      `需要分析: ${needAnalysis} 条\n` +
      `已分析: ${alreadyAnalyzed} 条\n\n` +
      `预计需要 ${Math.ceil(needAnalysis * 1.5 / 60)} 分钟`;

    setConfirmDialog({
      isOpen: true,
      title: '🤖 AI 批量分析',
      message: confirmMessage,
      onConfirm: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        executeAIAnalysis();
      },
    });
  };

  // 执行 AI 分析
  const executeAIAnalysis = async () => {
    console.log('✅ 用户确认，开始分析...');
    setAiAnalyzing(true);
    setAiProgress({ current: 0, total: events.length });

    try {
      console.log('📡 调用 AI 批量分析...');
      const results = await analyzeEventsInBatch(
        events,
        ai,
        modelName,
        (current, total) => {
          console.log(`📊 进度: ${current}/${total}`);
          setAiProgress({ current, total });
        }
      );

      console.log('✅ 分析完成，保存结果...', { resultCount: results.size });

      // 合并新的分析结果
      const updatedAnalyses = new Map([...aiAnalyses, ...results]);
      setAiAnalyses(updatedAnalyses);
      
      // 保存到 localStorage
      saveAIAnalysisToStorage(updatedAnalyses);
      console.log('💾 已保存到 localStorage');

      // 重新加载事件以显示分析结果
      // 注意：这里需要重新加载完整数据，因为批量分析针对的是原始数据
      loadEvents();
      console.log('🔄 已更新事件显示');

      setAlertDialog({
        isOpen: true,
        title: '分析完成！',
        message: 
          `成功分析: ${results.size} 条记录\n` +
          `总计: ${updatedAnalyses.size} 条已分析\n\n` +
          `请查看事件卡片上的 AI 标签`,
        type: 'success',
      });
    } catch (error: any) {
      console.error('❌ 批量分析失败:', error);
      setAlertDialog({
        isOpen: true,
        title: '分析失败',
        message: 
          `错误信息: ${error.message || '未知错误'}\n\n` +
          `请检查：\n` +
          `1. 网络连接是否正常\n` +
          `2. API Key 是否有效\n` +
          `3. 控制台是否有错误信息`,
        type: 'error',
      });
    } finally {
      setAiAnalyzing(false);
      setAiProgress({ current: 0, total: 0 });
      console.log('🏁 分析流程结束');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 pb-24 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-stone-700">时光回溯 🕰️</h2>
                    
                    {/* 连接状态指示器 */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold ${
                      isConnected 
                        ? 'bg-green-50 text-green-600 border border-green-200' 
                        : 'bg-orange-50 text-orange-600 border border-orange-200'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
                      {isConnected ? 'Screenpipe 已连接' : '使用演示数据'}
                    </div>
                </div>

                {/* AI 分析和刷新按钮 */}
                <div className="flex items-center gap-2">
                    {/* 排序切换按钮 */}
                    <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-xl hover:border-blue-200 transition-all shadow-sm group"
                        title={sortOrder === 'asc' ? '当前：正序（旧到新），点击切换为倒序' : '当前：倒序（新到旧），点击切换为正序'}
                    >
                        <svg 
                            className={`w-4 h-4 transition-all ${sortOrder === 'asc' ? 'text-blue-600' : 'text-blue-600 rotate-180'}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                        <span className="text-xs font-bold text-stone-600 group-hover:text-blue-600">
                            {sortOrder === 'asc' ? '⏫ 正序' : '⏬ 倒序'}
                        </span>
                    </button>

                    {/* 合并开关 */}
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-xl cursor-pointer hover:border-emerald-200 transition-all shadow-sm group">
                            <input 
                                type="checkbox"
                                checked={mergeEnabled}
                                onChange={(e) => handleToggleMerge(e.target.checked)}
                                className="sr-only"
                            />
                            <div className={`w-10 h-5 rounded-full transition-colors ${mergeEnabled ? 'bg-emerald-500' : 'bg-stone-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5 ${mergeEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`}></div>
                            </div>
                            <span className={`text-xs font-bold transition-colors ${mergeEnabled ? 'text-emerald-600' : 'text-stone-500'}`}>
                                🔀 智能合并
                            </span>
                        </label>
                        
                        {/* 设置按钮 */}
                        {mergeEnabled && (
                            <button
                                onClick={() => setIsMergeSettingsOpen(true)}
                                className="p-2 bg-white border border-stone-200 hover:border-emerald-200 rounded-xl transition-all shadow-sm hover:bg-emerald-50"
                                title="合并设置"
                            >
                                <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* AI 开关 */}
                    <label className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-xl cursor-pointer hover:border-violet-200 transition-all shadow-sm group">
                        <input 
                            type="checkbox"
                            checked={aiEnabled}
                            onChange={(e) => setAiEnabled(e.target.checked)}
                            className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${aiEnabled ? 'bg-violet-500' : 'bg-stone-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5 ${aiEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`}></div>
                        </div>
                        <span className={`text-xs font-bold transition-colors ${aiEnabled ? 'text-violet-600' : 'text-stone-500'}`}>
                            ✨ AI分析
                        </span>
                    </label>

                    {/* AI 分析说明 - 节省 Token，改为单条分析 */}
                    {aiEnabled && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-100 rounded-xl">
                            <svg className="w-4 h-4 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-medium text-violet-700">
                                点击"恢复上下文"进行 AI 分析
                            </span>
                        </div>
                    )}

                    {/* 批量分析按钮 - 暂时隐藏以节省 Token */}
                    {false && aiEnabled && (
                        <button 
                            onClick={handleAIAnalyze}
                            disabled={aiAnalyzing || loading || events.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {aiAnalyzing ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    分析中 {aiProgress.current}/{aiProgress.total}
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    批量分析
                                </>
                            )}
                        </button>
                    )}
                    
                    {/* 清除缓存按钮 */}
                    <button 
                        onClick={handleClearCache}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-200 rounded-xl text-sm font-bold text-stone-600 hover:text-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        title="清除所有合并缓存"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        清除缓存
                    </button>

                    {/* 清理视频按钮 */}
                    <button 
                        onClick={handleCleanVideos}
                        disabled={isCleaning || !isConnected}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-purple-50 border border-stone-200 hover:border-purple-200 rounded-xl text-sm font-bold text-stone-600 hover:text-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        title="删除 1 天前的旧视频文件（保留文字数据）"
                    >
                        <svg className={`w-4 h-4 ${isCleaning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isCleaning ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            )}
                        </svg>
                        {isCleaning ? '清理中...' : '清理视频'}
                    </button>

                    {/* 刷新按钮 */}
                    <button 
                        onClick={handleRefresh}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-200 rounded-xl text-sm font-bold text-stone-600 hover:text-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {loading ? '加载中...' : '刷新'}
                    </button>
                </div>
            </div>
            
            <p className="text-stone-500 mb-4">
              {isConnected 
                ? '基于 Screenpipe 捕获的数字记忆' 
                : 'Screenpipe 未运行，显示演示数据。请启动 Screenpipe 查看真实数据。'}
            </p>

            {/* 筛选控件 */}
            <div className="glass p-4 rounded-2xl border border-white/60 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* 日期选择器 */}
                    <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">📅 日期</label>
                        <input 
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 focus:ring-2 focus:ring-rose-100 focus:border-rose-200 outline-none transition-all"
                        />
                    </div>

                    {/* 开始时间 */}
                    <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">🌅 开始时间</label>
                        <select
                            value={startHour}
                            onChange={(e) => setStartHour(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 focus:ring-2 focus:ring-rose-100 focus:border-rose-200 outline-none transition-all"
                        >
                            {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>
                                    {String(i).padStart(2, '0')}:00
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 结束时间 */}
                    <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">🌆 结束时间</label>
                        <select
                            value={endHour}
                            onChange={(e) => setEndHour(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 focus:ring-2 focus:ring-rose-100 focus:border-rose-200 outline-none transition-all"
                        >
                            {Array.from({ length: 24 }, (_, i) => (
                                <option key={i} value={i}>
                                    {String(i).padStart(2, '0')}:59
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 应用筛选 */}
                    <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">💻 应用筛选</label>
                        <select
                            value={selectedApp}
                            onChange={(e) => setSelectedApp(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 focus:ring-2 focus:ring-rose-100 focus:border-rose-200 outline-none transition-all"
                        >
                            <option value="">全部应用</option>
                            {availableApps.map(app => (
                                <option key={app} value={app}>{app}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 快捷时间按钮 */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-stone-100">
                    <span className="text-xs font-bold text-stone-500 mr-2">快捷:</span>
                    <button 
                        onClick={() => { setStartHour(9); setEndHour(12); }}
                        className="px-3 py-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-bold text-sky-700 transition-all"
                    >
                        上午 (9-12)
                    </button>
                    <button 
                        onClick={() => { setStartHour(13); setEndHour(18); }}
                        className="px-3 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold text-amber-700 transition-all"
                    >
                        下午 (13-18)
                    </button>
                    <button 
                        onClick={() => { setStartHour(19); setEndHour(23); }}
                        className="px-3 py-1 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg text-xs font-bold text-violet-700 transition-all"
                    >
                        晚上 (19-23)
                    </button>
                    <button 
                        onClick={() => { setStartHour(0); setEndHour(23); }}
                        className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700 transition-all"
                    >
                        全天
                    </button>
                </div>

                {/* 结果统计 - 增强版 */}
                {!loading && isConnected && (
                    <div className="mt-3 pt-3 border-t border-stone-100">
                        <div className="flex items-center gap-2 text-xs">
                            {/* 数据处理流程 */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-stone-500">API返回</span>
                                <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                    {apiReturnedCount}
                                </span>
                            </div>
                            
                            <svg className="w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            
                            <div className="flex items-center gap-1.5">
                                <span className="text-stone-500">过滤空内容</span>
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    {afterFilterCount}
                                </span>
                                {apiReturnedCount > afterFilterCount && (
                                    <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                                        -{apiReturnedCount - afterFilterCount}
                                    </span>
                                )}
                            </div>
                            
                            {mergeEnabled && (
                                <>
                                    <svg className="w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-stone-500">智能合并</span>
                                        <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                            {events.length}
                                        </span>
                                        {afterFilterCount > events.length && (
                                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                -{afterFilterCount - events.length}
                                            </span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {/* 时间和应用信息 */}
                        <div className="mt-2 text-xs text-stone-400">
                            {new Date(selectedDate).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} {String(startHour).padStart(2, '0')}:00 - {String(endHour).padStart(2, '0')}:59
                            {selectedApp && ` · 应用: ${selectedApp}`}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="text-stone-500 font-semibold">加载中...</div>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <div className="text-6xl mb-4">📭</div>
                <div className="text-stone-600 font-bold mb-2">没有找到记录</div>
                <div className="text-sm text-stone-500">
                    {isConnected 
                        ? '在选择的时间范围内没有捕获到活动数据' 
                        : 'Screenpipe 未运行，请启动后重试'}
                </div>
                {isConnected && (
                    <button 
                        onClick={() => { setStartHour(0); setEndHour(23); setSelectedApp(''); }}
                        className="mt-4 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-sm font-bold text-rose-600 transition-all"
                    >
                        重置筛选条件
                    </button>
                )}
            </div>
          </div>
        ) : (
          <div className="relative pl-8 border-l-2 border-rose-100 space-y-8">
            {sortedEvents.map((event, idx) => (
                <div key={event.id} className="relative group">
                    {/* Time Dot */}
                    <div className="absolute -left-[41px] top-3 w-5 h-5 bg-white border-4 border-rose-200 rounded-full shadow-sm group-hover:scale-125 group-hover:border-rose-400 transition-all z-10"></div>
                    
                    {/* Card */}
                    <div className="glass p-4 rounded-2xl border border-white/60 shadow-sm hover:shadow-md transition-all relative hover:-translate-y-1 cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* 时间显示 */}
                                {event.mergedCount > 1 ? (
                                    <>
                                        <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md border border-emerald-200">
                                            {new Date(event.timeRange.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            {' - '}
                                            {new Date(event.timeRange.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                        <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                            </svg>
                                            合并 {event.mergedCount} 条
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-xs font-bold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md">
                                        {new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                )}
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${event.type === 'Audio' ? 'bg-purple-50 text-purple-600 border-purple-100' : event.type === 'UI' ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                    {event.type}
                                </span>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEventDetail(event);
                                }}
                                className="text-xs font-bold text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                                恢复上下文 ↗
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-1">
                            <LaptopIcon className="w-4 h-4 text-stone-400" />
                            <h3 className="font-bold text-stone-700">{event.appName}</h3>
                            <span className="text-stone-300">|</span>
                            <span className="text-sm text-stone-500 truncate max-w-[200px] sm:max-w-md">{event.windowTitle}</span>
                        </div>
                        
                        {/* 内容预览：如果有 AI 分析则显示摘要，否则显示原始内容 */}
                        {aiEnabled && event.aiAnalysis ? (
                            // 显示 AI 分析摘要
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 p-3 rounded-lg border border-violet-200">
                                    <svg className="w-4 h-4 text-violet-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                                    </svg>
                                    <p className="text-sm font-medium text-violet-900 flex-1">
                                        {event.aiAnalysis.summary}
                                    </p>
                                </div>
                                
                                {/* AI 标签 */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    {event.aiAnalysis.keywords.slice(0, 3).map((keyword, i) => (
                                        <span key={i} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-md border border-violet-200 font-medium">
                                            #{keyword}
                                        </span>
                                    ))}
                                    <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-200 font-medium">
                                        {event.aiAnalysis.category}
                                    </span>
                                    <span className="text-xs text-amber-600 flex items-center gap-0.5">
                                        {'⭐'.repeat(event.aiAnalysis.importance)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            // 显示原始内容预览
                            <p className="text-sm text-stone-500 mt-2 bg-stone-50/50 p-2 rounded-lg italic border border-stone-100/50">
                                "{event.content.substring(0, 80)}..."
                            </p>
                        )}
                    </div>
                </div>
            ))}
          </div>
        )}

        {/* 事件详情弹窗 */}
        <EventDetailModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          event={selectedEvent}
          onAnalysisComplete={handleSingleAnalysisComplete}
          ai={ai}
          modelName={modelName}
        />

        {/* 确认对话框 */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => {
            console.log('❌ 用户取消了分析');
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          }}
        />

        {/* 提示对话框 */}
        <AlertDialog
          isOpen={alertDialog.isOpen}
          title={alertDialog.title}
          message={alertDialog.message}
          type={alertDialog.type}
          onConfirm={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        />

        {/* 合并设置对话框 */}
        <MergeSettingsModal
          isOpen={isMergeSettingsOpen}
          onClose={() => setIsMergeSettingsOpen(false)}
          onSave={handleSaveMergeSettings}
          currentSettings={{
            similarityThreshold: mergeSettings.similarityThreshold,
            timeWindowMinutes: mergeSettings.timeWindowMinutes,
          }}
        />
    </div>
  );
};

