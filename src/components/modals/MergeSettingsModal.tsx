import React, { useState } from 'react';
import { Modal } from '../common/Modal';

interface MergeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: {
    similarityThreshold: number;
    timeWindowMinutes: number;
  }) => void;
  currentSettings: {
    similarityThreshold: number;
    timeWindowMinutes: number;
  };
}

export const MergeSettingsModal: React.FC<MergeSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
}) => {
  const [similarity, setSimilarity] = useState(currentSettings.similarityThreshold);
  const [timeWindow, setTimeWindow] = useState(currentSettings.timeWindowMinutes);

  const handleSave = () => {
    onSave({
      similarityThreshold: similarity,
      timeWindowMinutes: timeWindow,
    });
    onClose();
  };

  const handleReset = () => {
    setSimilarity(0.8);
    setTimeWindow(5);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            合并设置
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors p-2 hover:bg-stone-50 rounded-xl"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* 相似度阈值 */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-3">
              📊 内容相似度阈值
            </label>
            <div className="space-y-3">
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={similarity}
                onChange={(e) => setSimilarity(parseFloat(e.target.value))}
                className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${(similarity - 0.5) / 0.5 * 100}%, #e5e7eb ${(similarity - 0.5) / 0.5 * 100}%, #e5e7eb 100%)`,
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500">50% (宽松)</span>
                <div className="text-center">
                  <span className="text-2xl font-bold text-emerald-600">
                    {Math.round(similarity * 100)}%
                  </span>
                  <p className="text-xs text-stone-500 mt-1">
                    当前阈值
                  </p>
                </div>
                <span className="text-xs text-stone-500">100% (严格)</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs text-emerald-700">
                  <span className="font-bold">说明：</span>
                  {similarity >= 0.9 && ' 非常严格，只合并几乎完全相同的内容'}
                  {similarity >= 0.75 && similarity < 0.9 && ' 适中，合并相似度较高的内容'}
                  {similarity < 0.75 && ' 宽松，合并更多相似内容'}
                </p>
              </div>
            </div>
          </div>

          {/* 时间窗口 */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-3">
              ⏱️ 时间窗口（分钟）
            </label>
            <div className="space-y-3">
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={timeWindow}
                onChange={(e) => setTimeWindow(parseInt(e.target.value))}
                className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${(timeWindow - 1) / 14 * 100}%, #e5e7eb ${(timeWindow - 1) / 14 * 100}%, #e5e7eb 100%)`,
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500">1 分钟</span>
                <div className="text-center">
                  <span className="text-2xl font-bold text-emerald-600">
                    {timeWindow}
                  </span>
                  <p className="text-xs text-stone-500 mt-1">
                    分钟
                  </p>
                </div>
                <span className="text-xs text-stone-500">15 分钟</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs text-emerald-700">
                  <span className="font-bold">说明：</span>
                  {timeWindow <= 3 && ' 严格，只合并时间很接近的记录'}
                  {timeWindow > 3 && timeWindow <= 8 && ' 适中，合并短时间内的记录'}
                  {timeWindow > 8 && ' 宽松，合并更长时间内的记录'}
                </p>
              </div>
            </div>
          </div>

          {/* 预设方案 */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-3">
              🎯 快速预设
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => { setSimilarity(0.9); setTimeWindow(3); }}
                className="p-3 bg-white border-2 border-stone-200 hover:border-emerald-500 rounded-xl transition-all text-center group"
              >
                <div className="text-lg font-bold text-stone-700 group-hover:text-emerald-600">严格</div>
                <div className="text-xs text-stone-500 mt-1">90% / 3分钟</div>
              </button>
              <button
                onClick={() => { setSimilarity(0.8); setTimeWindow(5); }}
                className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-500 rounded-xl transition-all text-center"
              >
                <div className="text-lg font-bold text-emerald-700">推荐</div>
                <div className="text-xs text-emerald-600 mt-1">80% / 5分钟</div>
              </button>
              <button
                onClick={() => { setSimilarity(0.7); setTimeWindow(10); }}
                className="p-3 bg-white border-2 border-stone-200 hover:border-emerald-500 rounded-xl transition-all text-center group"
              >
                <div className="text-lg font-bold text-stone-700 group-hover:text-emerald-600">宽松</div>
                <div className="text-xs text-stone-500 mt-1">70% / 10分钟</div>
              </button>
            </div>
          </div>

          {/* 说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-700 mb-1">合并规则</p>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• 必须是<span className="font-bold">同一应用</span>才会考虑合并</li>
                  <li>• 时间间隔必须在设置的窗口内</li>
                  <li>• 内容相似度必须达到设置的阈值</li>
                  <li>• 三个条件同时满足才会合并</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-stone-200">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-bold transition-all"
          >
            重置为默认
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-bold transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all shadow-sm"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

