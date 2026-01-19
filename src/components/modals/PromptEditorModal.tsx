import React, { useState, useEffect } from 'react';

interface PromptEditorModalProps {
  isOpen: boolean;
  title: string;
  promptType: 'daily_detailed' | 'daily_leader' | 'weekly_from_daily' | 'weekly_from_raw';
  defaultPrompt: string;
  currentPrompt?: string;
  availableVariables?: Array<{ name: string; description: string }>;
  onSave: (prompt: string) => void;
  onClose: () => void;
}

export const PromptEditorModal = ({
  isOpen,
  title,
  promptType,
  defaultPrompt,
  currentPrompt,
  availableVariables = [],
  onSave,
  onClose
}: PromptEditorModalProps) => {
  const [prompt, setPrompt] = useState(currentPrompt || defaultPrompt);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    setPrompt(currentPrompt || defaultPrompt);
  }, [currentPrompt, defaultPrompt, isOpen]);

  useEffect(() => {
    // 计算字数（中文按字符，英文按单词）
    const chineseChars = (prompt.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = prompt.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    setWordCount(chineseChars + englishWords);
  }, [prompt]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (prompt.trim()) {
      onSave(prompt.trim());
      onClose();
    } else {
      alert('提示词不能为空！');
    }
  };

  const handleReset = () => {
    if (confirm('确定要重置为默认提示词吗？这将覆盖当前的自定义内容。')) {
      setPrompt(defaultPrompt);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    // Cmd/Ctrl + S 保存
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const isCustom = prompt !== defaultPrompt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-100 w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-stone-200">
          <div>
            <h3 className="text-xl font-bold text-stone-800 flex items-center gap-2">
              ⚙️ {title}
            </h3>
            <p className="text-sm text-stone-500 mt-1">
              自定义 AI 提示词，控制报告生成的风格和内容
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Status Badge */}
          {isCustom && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2 text-sm">
              <span className="text-blue-600 font-semibold">✨ 已自定义</span>
              <span className="text-blue-700">当前使用的是你自定义的提示词</span>
            </div>
          )}

          {/* Prompt Editor */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-stone-700">
                📝 提示词内容
              </label>
              <span className="text-xs text-stone-500">
                {wordCount} 字
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的自定义提示词..."
              className="w-full h-64 p-4 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-stone-800 leading-relaxed font-mono resize-none"
              style={{ fontFamily: 'SF Mono, Monaco, Consolas, monospace' }}
            />
            <p className="text-xs text-stone-400 mt-2">
              💡 提示：使用 Cmd/Ctrl + S 快速保存，Esc 关闭
            </p>
          </div>

          {/* Available Variables */}
          {availableVariables.length > 0 && (
            <div className="bg-stone-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
                💡 可用变量（生成时自动替换）
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {availableVariables.map((variable) => (
                  <div key={variable.name} className="flex items-start gap-2 text-xs">
                    <code className="bg-white px-2 py-1 rounded border border-stone-200 text-blue-600 font-mono">
                      {variable.name}
                    </code>
                    <span className="text-stone-600">{variable.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-amber-800 mb-2">✍️ 编写提示词的技巧</h4>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• 明确说明报告的格式要求（如使用 Markdown）</li>
              <li>• 列出希望包含的章节结构</li>
              <li>• 指定报告的语言风格（专业、简洁、详细等）</li>
              <li>• 说明需要过滤或突出的内容类型</li>
              <li>• 控制报告长度（如 800-1200 字）</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-stone-200 bg-stone-50">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-semibold text-stone-600 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors flex items-center gap-2"
          >
            🔄 重置为默认
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-stone-600 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-md"
            >
              💾 保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
