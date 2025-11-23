import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { ScreenpipeEvent, AIAnalysis } from '../../types';
import { MergedEvent } from '../../utils/contentMerger';
import { analyzeEventWithAI } from '../../utils/aiAnalyzer';
import { GoogleGenAI } from '@google/genai';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: (ScreenpipeEvent | MergedEvent) | null;
  onAnalysisComplete?: (eventId: string, analysis: AIAnalysis) => void;
}

export const EventDetailModal = ({ isOpen, onClose, event, onAnalysisComplete }: EventDetailModalProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localAnalysis, setLocalAnalysis] = useState<AIAnalysis | undefined>(undefined);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [showMergedDetails, setShowMergedDetails] = useState(false);

  // 初始化 AI 客户端
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  // 当事件变化时，更新本地分析结果
  useEffect(() => {
    if (event) {
      setLocalAnalysis(event.aiAnalysis);
    }
  }, [event]);

  if (!event) return null;

  // 当前显示的分析结果（优先使用本地分析）
  const displayAnalysis = localAnalysis || event.aiAnalysis;

  // 执行 AI 分析
  const handleAnalyze = async () => {
    if (!event || isAnalyzing) return;

    if (!process.env.API_KEY) {
      alert('未配置 API Key\n\n请在 .env 文件中配置 GEMINI_API_KEY');
      return;
    }

    console.log('🔍 开始分析事件:', event.id);
    setIsAnalyzing(true);

    try {
      const analysis = await analyzeEventWithAI(event, ai);
      console.log('✅ 分析完成:', analysis);
      
      // 更新本地状态
      setLocalAnalysis(analysis);

      // 通知父组件更新
      if (onAnalysisComplete) {
        onAnalysisComplete(event.id, analysis);
      }
    } catch (error: any) {
      console.error('❌ 分析失败:', error);
      alert(`分析失败\n\n${error.message || '未知错误'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 复制内容
  const handleCopy = () => {
    navigator.clipboard.writeText(event.content);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-rose-50 via-white to-white border-b border-stone-100 p-6 backdrop-blur-xl bg-white/90">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-black text-stone-700 mb-2">📋 事件详情</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md">
                {new Date(event.timestamp).toLocaleString('zh-CN')}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                event.type === 'Audio' 
                  ? 'bg-purple-50 text-purple-600 border-purple-100' 
                  : event.type === 'UI' 
                  ? 'bg-pink-50 text-pink-600 border-pink-100' 
                  : 'bg-blue-50 text-blue-600 border-blue-100'
              }`}>
                {event.type}
              </span>
              {event.confidence && (
                <span className="text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-md">
                  置信度: {Math.round(event.confidence * 100)}%
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors p-2 hover:bg-stone-50 rounded-xl"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 p-6 space-y-4">
        {/* 应用信息 */}
        <div className="glass p-4 rounded-2xl border border-white/60 shadow-sm">
          <h3 className="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            应用信息
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-stone-400 min-w-[60px]">应用名称</span>
              <span className="text-sm font-semibold text-stone-700 flex-1">{event.appName}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-stone-400 min-w-[60px]">窗口标题</span>
              <span className="text-sm text-stone-600 flex-1">{event.windowTitle || '(无)'}</span>
            </div>
          </div>
        </div>

        {/* 合并记录信息 */}
        {'mergedCount' in event && event.mergedCount > 1 && (
          <div className="glass p-4 rounded-2xl border border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-emerald-600 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                智能合并记录
              </h3>
              <button
                onClick={() => setShowMergedDetails(!showMergedDetails)}
                className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                {showMergedDetails ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    收起
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    展开
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-700 font-bold">合并数量:</span>
                <span className="text-stone-700">{event.mergedCount} 条相似记录</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-700 font-bold">时间范围:</span>
                <span className="text-stone-700">
                  {new Date(event.timeRange.start).toLocaleTimeString('zh-CN')}
                  {' - '}
                  {new Date(event.timeRange.end).toLocaleTimeString('zh-CN')}
                </span>
              </div>

              {/* 展开显示所有原始记录 */}
              {showMergedDetails && event.originalEvents && (
                <div className="mt-3 pt-3 border-t border-emerald-100 space-y-2">
                  <p className="text-xs font-bold text-emerald-700 mb-2">原始记录列表:</p>
                  {event.originalEvents.map((origEvent, idx) => (
                    <div key={origEvent.id} className="bg-white/80 p-3 rounded-lg border border-emerald-100 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-stone-600">#{idx + 1}</span>
                        <span className="text-stone-500">
                          {new Date(origEvent.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                        {origEvent.confidence && (
                          <span className="text-emerald-600">
                            置信度: {Math.round(origEvent.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 line-clamp-2">
                        {origEvent.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI 分析区域 */}
        <div className="glass p-4 rounded-2xl border border-violet-200 shadow-sm bg-gradient-to-br from-violet-50/50 to-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-violet-600 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
              </svg>
              AI 智能分析
            </h3>
            
            {/* AI 分析按钮 */}
            {!displayAnalysis && !isAnalyzing && (
              <button
                onClick={handleAnalyze}
                className="px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                </svg>
                AI 分析此条
              </button>
            )}

            {/* 重新分析按钮 */}
            {displayAnalysis && !isAnalyzing && (
              <button
                onClick={handleAnalyze}
                className="px-3 py-1.5 bg-white hover:bg-violet-50 text-violet-600 text-xs font-bold rounded-lg transition-all border border-violet-200 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重新分析
              </button>
            )}
          </div>

          {/* 分析中状态 */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-6 h-6 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-violet-600">AI 正在分析中...</p>
                <p className="text-xs text-stone-500 mt-1">这可能需要几秒钟</p>
              </div>
            </div>
          )}

          {/* 未分析状态 */}
          {!displayAnalysis && !isAnalyzing && (
            <div className="text-center py-8 space-y-3">
              <div className="text-4xl">🤖</div>
              <div>
                <p className="text-sm font-bold text-stone-600">尚未进行 AI 分析</p>
                <p className="text-xs text-stone-500 mt-1">点击上方按钮开始分析此条记录</p>
              </div>
            </div>
          )}

          {/* 分析结果 */}
          {displayAnalysis && !isAnalyzing && (
            <div className="space-y-3">
              <div>
                <span className="text-xs font-bold text-violet-600 block mb-1">📝 内容摘要</span>
                <p className="text-sm text-stone-700 bg-white/80 p-3 rounded-lg border border-violet-100 leading-relaxed">
                  {displayAnalysis.summary}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-violet-600">🏷️ 关键词:</span>
                {displayAnalysis.keywords.map((keyword, i) => (
                  <span key={i} className="text-xs bg-white text-violet-600 px-2 py-1 rounded-lg border border-violet-200 font-medium">
                    #{keyword}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-violet-600">📂 分类:</span>
                  <span className="text-xs bg-white text-amber-600 px-2 py-1 rounded-lg border border-amber-200 font-medium">
                    {displayAnalysis.category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-violet-600">⭐ 重要性:</span>
                  <span className="text-xs text-amber-600 font-medium">
                    {'⭐'.repeat(displayAnalysis.importance)}
                  </span>
                </div>
              </div>
              <div className="text-xs text-stone-400 pt-2 border-t border-violet-100">
                分析时间: {new Date(displayAnalysis.analyzedAt).toLocaleString('zh-CN')}
              </div>
            </div>
          )}
        </div>

        {/* 完整内容 */}
        <div className="glass p-4 rounded-2xl border border-white/60 shadow-sm">
          <h3 className="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {event.type === 'Audio' ? '音频转录内容' : event.type === 'UI' ? 'UI 内容' : 'OCR 识别内容'}
          </h3>
          <div className="bg-stone-50/80 p-4 rounded-xl border border-stone-100/80 max-h-96 overflow-y-auto">
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap break-words font-mono">
              {event.content || '(无内容)'}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-stone-400">
            <span>字符数: {event.content.length}</span>
            <button 
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 hover:bg-stone-100 rounded-lg transition-colors text-rose-600 hover:text-rose-700 font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              复制内容
            </button>
          </div>
        </div>

        {/* 时间戳详情 */}
        <div className="glass p-4 rounded-2xl border border-white/60 shadow-sm">
          <h3 className="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            时间信息
          </h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-stone-400 min-w-[60px]">记录时间</span>
              <span className="text-sm text-stone-600 flex-1">
                {new Date(event.timestamp).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  weekday: 'long'
                })}
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-bold text-stone-400 min-w-[60px]">原始时间</span>
              <span className="text-xs font-mono text-stone-500 flex-1">{event.timestamp}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 z-10 bg-gradient-to-br from-white via-white to-rose-50 border-t border-stone-100 p-4 backdrop-blur-xl bg-white/90">
        <button
          onClick={onClose}
          className="w-full py-3 px-4 bg-gradient-to-r from-stone-100 to-stone-200 hover:from-stone-200 hover:to-stone-300 text-stone-700 font-bold rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          关闭
        </button>
      </div>

      {/* 复制成功提示 Toast */}
      {showCopiedToast && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[10000] animate-fade-in">
          <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">已复制到剪贴板</span>
          </div>
        </div>
      )}
    </Modal>
  );
};

