import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import type { ScreenpipeEvent } from '../../types';

export type FilterStrategy = 'smart' | 'dedup' | 'custom' | 'none';

export interface ReportSettings {
    filterStrategy: FilterStrategy;
    customApps: string[];
    maxDailyRecords: number;
    maxWeeklyRecords: number;
}

interface ReportSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: ReportSettings;
    onSave: (settings: ReportSettings) => void;
    availableApps?: string[]; // 从时间线数据中获取的可用应用列表
}

const DEFAULT_WORK_APPS = [
    'Visual Studio Code', 'VS Code', 'Code',
    'Terminal', 'iTerm', 'iTerm2',
    'Google Chrome', 'Chrome', 'Safari', 'Firefox', 'Edge',
    'Slack', 'WeChat', 'DingTalk', '钉钉', 'Lark', '飞书',
    'Zoom', 'Microsoft Teams', 'Skype',
    'Xcode', 'Android Studio', 'IntelliJ IDEA', 'PyCharm', 'WebStorm',
    'Figma', 'Sketch', 'Adobe XD',
    'Notion', 'Obsidian', 'Typora', 'Logseq',
    'Postman', 'Insomnia',
    'GitHub Desktop', 'GitKraken', 'Sourcetree',
    'Docker Desktop', 'TablePlus', 'Sequel Pro',
    'Microsoft Word', 'Excel', 'PowerPoint', 'Pages', 'Numbers', 'Keynote'
];

export const ReportSettingsModal: React.FC<ReportSettingsModalProps> = ({
    isOpen,
    onClose,
    settings,
    onSave,
    availableApps = []
}) => {
    const [localSettings, setLocalSettings] = useState<ReportSettings>(settings);
    const [newApp, setNewApp] = useState('');
    const [showAppPicker, setShowAppPicker] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    const handleAddApp = () => {
        if (newApp.trim() && !localSettings.customApps.includes(newApp.trim())) {
            setLocalSettings({
                ...localSettings,
                customApps: [...localSettings.customApps, newApp.trim()]
            });
            setNewApp('');
        }
    };

    const handleRemoveApp = (app: string) => {
        setLocalSettings({
            ...localSettings,
            customApps: localSettings.customApps.filter(a => a !== app)
        });
    };

    const handleLoadDefaults = () => {
        setLocalSettings({
            ...localSettings,
            customApps: DEFAULT_WORK_APPS
        });
    };

    const handleToggleApp = (app: string) => {
        if (localSettings.customApps.includes(app)) {
            setLocalSettings({
                ...localSettings,
                customApps: localSettings.customApps.filter(a => a !== app)
            });
        } else {
            setLocalSettings({
                ...localSettings,
                customApps: [...localSettings.customApps, app]
            });
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-6 max-w-2xl max-h-[85vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-stone-800 mb-6">📊 日报周报生成设置</h2>

                {/* 策略选择 */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-stone-700 mb-3">筛选策略</h3>
                    
                    <div className="space-y-3">
                        {/* 方案 1: 智能筛选 */}
                        <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors"
                            style={{
                                borderColor: localSettings.filterStrategy === 'smart' ? '#10b981' : '#e7e5e4'
                            }}>
                            <input
                                type="radio"
                                name="strategy"
                                value="smart"
                                checked={localSettings.filterStrategy === 'smart'}
                                onChange={(e) => setLocalSettings({ ...localSettings, filterStrategy: e.target.value as FilterStrategy })}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="font-bold text-stone-800 mb-1">
                                    ⭐ 方案 1: 智能筛选（推荐）
                                </div>
                                <div className="text-xs text-stone-600 space-y-1">
                                    <div>✅ 只保留工作相关应用（开发、协作、文档等）</div>
                                    <div>✅ 自动过滤娱乐和系统应用</div>
                                    <div>✅ 去除 1 分钟内的重复记录</div>
                                    <div>💡 <strong>推荐</strong>：适合大多数场景，平衡质量和效率</div>
                                </div>
                            </div>
                        </label>

                        {/* 方案 2: 内容去重 + 聚合 */}
                        <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors"
                            style={{
                                borderColor: localSettings.filterStrategy === 'dedup' ? '#10b981' : '#e7e5e4'
                            }}>
                            <input
                                type="radio"
                                name="strategy"
                                value="dedup"
                                checked={localSettings.filterStrategy === 'dedup'}
                                onChange={(e) => setLocalSettings({ ...localSettings, filterStrategy: e.target.value as FilterStrategy })}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="font-bold text-stone-800 mb-1">
                                    🔄 方案 2: 内容去重 + 聚合
                                </div>
                                <div className="text-xs text-stone-600 space-y-1">
                                    <div>✅ 保留所有应用的数据</div>
                                    <div>✅ 智能合并相似的连续内容</div>
                                    <div>✅ 按应用和窗口聚合统计</div>
                                    <div>💡 适合想要完整记录的用户</div>
                                </div>
                            </div>
                        </label>

                        {/* 方案 3: 自定义应用 */}
                        <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors"
                            style={{
                                borderColor: localSettings.filterStrategy === 'custom' ? '#10b981' : '#e7e5e4'
                            }}>
                            <input
                                type="radio"
                                name="strategy"
                                value="custom"
                                checked={localSettings.filterStrategy === 'custom'}
                                onChange={(e) => setLocalSettings({ ...localSettings, filterStrategy: e.target.value as FilterStrategy })}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="font-bold text-stone-800 mb-1">
                                    🎯 方案 3: 自定义应用列表
                                </div>
                                <div className="text-xs text-stone-600 space-y-1">
                                    <div>✅ 完全自定义关注的应用</div>
                                    <div>✅ 灵活性最高，精准控制</div>
                                    <div>✅ 适合特定工作流程</div>
                                    <div>💡 需要在下方配置应用列表</div>
                                </div>
                            </div>
                        </label>

                        {/* 方案 4: 不筛选（全部保留） */}
                        <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors"
                            style={{
                                borderColor: localSettings.filterStrategy === 'none' ? '#10b981' : '#e7e5e4'
                            }}>
                            <input
                                type="radio"
                                name="strategy"
                                value="none"
                                checked={localSettings.filterStrategy === 'none'}
                                onChange={(e) => setLocalSettings({ ...localSettings, filterStrategy: e.target.value as FilterStrategy })}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="font-bold text-stone-800 mb-1">
                                    📋 方案 4: 不筛选（按时间采样）
                                </div>
                                <div className="text-xs text-stone-600 space-y-1">
                                    <div>✅ 保留所有类型的应用</div>
                                    <div>✅ 按时间均匀采样</div>
                                    <div>⚠️ 可能消耗更多 API 配额</div>
                                    <div>💡 适合想要完整生活记录的用户</div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* 自定义应用列表 */}
                {localSettings.filterStrategy === 'custom' && (
                    <div className="mb-6 p-4 bg-stone-50 rounded-xl">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-stone-700">自定义应用列表</h3>
                            <div className="flex gap-2">
                                {availableApps.length > 0 && (
                                    <button
                                        onClick={() => setShowAppPicker(!showAppPicker)}
                                        className="text-xs px-3 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                                    >
                                        📋 从时间线选择
                                    </button>
                                )}
                                <button
                                    onClick={handleLoadDefaults}
                                    className="text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    加载默认工作应用
                                </button>
                            </div>
                        </div>

                        {/* 从时间线选择应用 */}
                        {showAppPicker && availableApps.length > 0 && (
                            <div className="mb-3 p-3 bg-white border border-emerald-200 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-xs font-bold text-stone-700">
                                        时间线中的应用（共 {availableApps.length} 个）
                                    </div>
                                    <button
                                        onClick={() => setShowAppPicker(false)}
                                        className="text-xs text-stone-400 hover:text-stone-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    <div className="space-y-1">
                                        {availableApps.map((app) => (
                                            <label
                                                key={app}
                                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-stone-50 rounded cursor-pointer text-xs"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={localSettings.customApps.includes(app)}
                                                    onChange={() => handleToggleApp(app)}
                                                    className="rounded"
                                                />
                                                <span className="text-stone-700">{app}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 手动添加应用 */}
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newApp}
                                onChange={(e) => setNewApp(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddApp()}
                                placeholder="或手动输入应用名称，如 VS Code"
                                className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                                onClick={handleAddApp}
                                className="px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                            >
                                添加
                            </button>
                        </div>

                        {/* 应用列表 */}
                        <div className="max-h-32 overflow-y-auto border border-stone-200 rounded-lg p-2 bg-white">
                            {localSettings.customApps.length === 0 ? (
                                <div className="text-xs text-stone-400 text-center py-4">
                                    还没有添加应用，点击"加载默认工作应用"快速开始
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {localSettings.customApps.map((app) => (
                                        <div
                                            key={app}
                                            className="flex items-center gap-2 px-3 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs"
                                        >
                                            <span className="text-stone-700">{app}</span>
                                            <button
                                                onClick={() => handleRemoveApp(app)}
                                                className="text-red-500 hover:text-red-700 font-bold"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="mt-2 text-xs text-stone-500">
                            💡 已添加 {localSettings.customApps.length} 个应用
                        </div>
                    </div>
                )}

                {/* 数据量限制 */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-stone-700 mb-3">数据量限制</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-stone-600 mb-1 block">
                                日报最大记录数（推荐: 500-1000）
                            </label>
                            <input
                                type="number"
                                value={localSettings.maxDailyRecords}
                                onChange={(e) => setLocalSettings({
                                    ...localSettings,
                                    maxDailyRecords: parseInt(e.target.value) || 800
                                })}
                                min="100"
                                max="2000"
                                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-stone-600 mb-1 block">
                                周报最大记录数（推荐: 1000-2000）
                            </label>
                            <input
                                type="number"
                                value={localSettings.maxWeeklyRecords}
                                onChange={(e) => setLocalSettings({
                                    ...localSettings,
                                    maxWeeklyRecords: parseInt(e.target.value) || 1500
                                })}
                                min="200"
                                max="5000"
                                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-stone-500">
                        💡 数值越大，报告越详细，但消耗更多 API 配额和生成时间
                    </div>
                </div>

                {/* 按钮 */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                        保存设置
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-stone-200 text-stone-700 font-bold rounded-lg hover:bg-stone-300 transition-colors"
                    >
                        取消
                    </button>
                </div>
            </div>
        </Modal>
    );
};

