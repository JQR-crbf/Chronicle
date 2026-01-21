import React, { useState, useEffect } from 'react';
import { loadGitHubConfig, saveGitHubConfig } from '../../utils/githubConfig';

// 声明 Tauri 全局类型
declare global {
    interface Window {
        __TAURI__: any;
    }
}

interface PatInputModalProps {
    isOpen: boolean;
    onConfirm: (pat: string, memberId: string, teamDir: string) => void;
    onCancel: () => void;
    onOpenPathSettings?: () => void;
}

export const PatInputModal: React.FC<PatInputModalProps> = ({ isOpen, onConfirm, onCancel, onOpenPathSettings }) => {
    const [pat, setPat] = useState('');
    const [showPat, setShowPat] = useState(false);
    const [memberId, setMemberId] = useState('');
    const [teamDir, setTeamDir] = useState('');
    const [rememberPat, setRememberPat] = useState(false);
    const [currentPath, setCurrentPath] = useState('~/Documents/Chronicle/日报');

    useEffect(() => {
        if (isOpen) {
            // 从 localStorage 读取缓存的配置
            const savedConfig = loadGitHubConfig();
            if (savedConfig) {
                setPat(savedConfig.pat);
                setMemberId(savedConfig.memberName);
                setTeamDir(savedConfig.teamDir);
                setRememberPat(!!savedConfig.pat); // 如果有保存的 PAT，默认勾选
            } else {
                // 兼容旧的缓存方式
                const savedMemberId = localStorage.getItem('github_member_id') || '金倩如';
                const savedTeamDir = localStorage.getItem('github_team_dir') || '中国团队 china-team';
                setPat('');
                setMemberId(savedMemberId);
                setTeamDir(savedTeamDir);
                setRememberPat(false);
            }
            setShowPat(false);
            
            // 获取当前保存路径
            if (window.__TAURI__) {
                window.__TAURI__.invoke('get_current_report_dir')
                    .then((path: string) => {
                        // 简化路径显示
                        const homePath = path.replace(/^\/Users\/[^\/]+/, '~');
                        setCurrentPath(homePath);
                    })
                    .catch(() => {
                        setCurrentPath('~/Documents/Chronicle/日报');
                    });
            }
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pat.trim() && memberId.trim() && teamDir.trim()) {
            // 根据用户选择决定是否保存 PAT
            if (rememberPat) {
                // 保存完整配置（包括 PAT）
                saveGitHubConfig({
                    pat: pat.trim(),
                    memberName: memberId.trim(),
                    teamDir: teamDir.trim()
                });
                console.log('✅ 已保存 GitHub 配置（包括 PAT）');
            } else {
                // 只保存成员名称和团队目录（兼容旧方式）
                localStorage.setItem('github_member_id', memberId.trim());
                localStorage.setItem('github_team_dir', teamDir.trim());
                console.log('✅ 已保存成员名称和团队目录（未保存 PAT）');
            }
            onConfirm(pat.trim(), memberId.trim(), teamDir.trim());
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
                        您可以选择记住 PAT，下次使用将自动填充。
                    </p>
                    
                    {/* 显示当前保存路径 */}
                    <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="text-xs font-bold text-stone-600 mb-1">
                                    📁 日报保存路径
                                </div>
                                <div className="text-xs text-stone-700 font-mono truncate">
                                    {currentPath}
                                </div>
                            </div>
                            {onOpenPathSettings && (
                                <button
                                    type="button"
                                    onClick={onOpenPathSettings}
                                    className="ml-3 px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    更改
                                </button>
                            )}
                        </div>
                    </div>
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
                        
                        {/* 记住 PAT 选项 */}
                        <label className="flex items-center gap-2 mt-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={rememberPat}
                                onChange={(e) => setRememberPat(e.target.checked)}
                                className="w-4 h-4 text-violet-500 border-stone-300 rounded focus:ring-2 focus:ring-violet-100 cursor-pointer"
                            />
                            <span className="text-xs text-stone-600 group-hover:text-stone-800 font-medium">
                                🔐 记住 PAT（保存到本地，下次自动填充）
                            </span>
                        </label>
                        
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

                    <div className="mb-6">
                        <label className="block text-xs font-bold text-stone-600 mb-2">
                            成员名称
                        </label>
                        <input
                            type="text"
                            value={memberId}
                            onChange={(e) => setMemberId(e.target.value)}
                            placeholder="例如：金倩如"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all text-sm"
                        />
                        <p className="text-xs text-stone-400 mt-2">
                            📁 用于生成 GitHub 路径中的成员目录名
                        </p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs font-bold text-stone-600 mb-2">
                            团队目录
                        </label>
                        <input
                            type="text"
                            value={teamDir}
                            onChange={(e) => setTeamDir(e.target.value)}
                            placeholder="例如：中国团队 china-team"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all text-sm"
                        />
                        <p className="text-xs text-stone-400 mt-2">
                            🌏 用于生成 GitHub 路径中的团队目录名
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
                            disabled={!pat.trim() || !memberId.trim() || !teamDir.trim()}
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
