import React, { useState, useEffect } from 'react';

interface PatInputModalProps {
    isOpen: boolean;
    onConfirm: (pat: string) => void;
    onCancel: () => void;
}

export const PatInputModal: React.FC<PatInputModalProps> = ({ isOpen, onConfirm, onCancel }) => {
    const [pat, setPat] = useState('');
    const [showPat, setShowPat] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPat('');
            setShowPat(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pat.trim()) {
            onConfirm(pat.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div 
                className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 border border-white/60"
                onKeyDown={handleKeyDown}
            >
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-stone-800 mb-2">
                        🔑 输入 GitHub Personal Access Token
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                        推送日报到 AIEC Team Hub 需要 GitHub PAT。<br/>
                        您的 PAT 不会被保存，仅用于本次推送。
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-stone-600 mb-2">
                            GitHub PAT
                        </label>
                        <div className="relative">
                            <input
                                type={showPat ? 'text' : 'password'}
                                value={pat}
                                onChange={(e) => setPat(e.target.value)}
                                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all text-sm font-mono"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPat(!showPat)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-sm"
                            >
                                {showPat ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <p className="text-xs text-stone-400 mt-2">
                            💡 创建 PAT: 
                            <a 
                                href="https://github.com/settings/tokens" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-violet-500 hover:text-violet-600 ml-1"
                            >
                                github.com/settings/tokens
                            </a>
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-6 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-sm transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={!pat.trim()}
                            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            确认推送
                        </button>
                    </div>
                </form>

                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs text-amber-700 leading-relaxed">
                        <span className="font-bold">⚠️ 权限要求：</span> PAT 需要 <code className="bg-amber-100 px-1 rounded">repo</code> 权限
                    </p>
                </div>
            </div>
        </div>
    );
};
