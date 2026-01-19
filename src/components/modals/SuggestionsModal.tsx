import React from 'react';
import { PlusIcon } from '../icons';

interface DraftSuggestion {
  id: number;
  title: string;
  time: string;
}

interface SuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: DraftSuggestion[];
  onAddTask: (title: string, draftId: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  isConnected: boolean;
}

export const SuggestionsModal: React.FC<SuggestionsModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onAddTask,
  onRefresh,
  isRefreshing,
  isConnected,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 animate-in zoom-in-95 duration-200">
        <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 mx-4">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-pink-400 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">🔔</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-800">AI 任务建议</h2>
                <p className="text-xs text-stone-500">
                  {isConnected ? `共 ${suggestions.length} 条建议` : 'Screenpipe 未连接'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Connection Warning */}
            {!isConnected && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="text-sm font-bold text-yellow-800 mb-1">Screenpipe 未连接</p>
                    <p className="text-xs text-yellow-700">
                      请确保 Screenpipe 正在运行，然后点击刷新按钮
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Refresh Button */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-bold text-stone-600">
                从您最近的活动中发现的任务
              </p>
              <button
                onClick={onRefresh}
                disabled={isRefreshing || !isConnected}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all
                  ${isRefreshing || !isConnected
                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:shadow-lg hover:scale-105 active:scale-95'
                  }
                `}
              >
                <svg 
                  className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                {isRefreshing ? '刷新中...' : '刷新建议'}
              </button>
            </div>

            {/* Suggestions List */}
            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="group relative bg-gradient-to-br from-stone-50 to-white hover:from-rose-50 hover:to-pink-50 rounded-xl border border-stone-200 hover:border-rose-200 p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-stone-800 group-hover:text-rose-600 transition-colors mb-2">
                          {suggestion.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span>🤖 AI 推荐</span>
                          <span>•</span>
                          <span>{suggestion.time}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onAddTask(suggestion.title, suggestion.id)}
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all group-hover:scale-110"
                        title="添加到待办"
                      >
                        <PlusIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-stone-100 to-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✨</span>
                  </div>
                  <p className="text-sm font-bold text-stone-600 mb-2">暂无任务建议</p>
                  {isConnected ? (
                    <p className="text-xs text-stone-500 max-w-xs mx-auto">
                      点击"刷新建议"按钮，AI 将分析您最近的活动并提供任务建议
                    </p>
                  ) : (
                    <p className="text-xs text-stone-500 max-w-xs mx-auto">
                      请先启动 Screenpipe 并点击刷新
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-stone-50 rounded-b-2xl border-t border-stone-100">
            <p className="text-xs text-stone-500 text-center">
              💡 提示：建议基于 Screenpipe 捕获的屏幕活动生成
            </p>
          </div>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d6d3d1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a8a29e;
        }
      `}</style>
    </>
  );
};
