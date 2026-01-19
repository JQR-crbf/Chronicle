import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 声明 Tauri 全局类型
declare global {
    interface Window {
        __TAURI__: any;
    }
}

interface ReportPathSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReportPathSettingsModal: React.FC<ReportPathSettingsModalProps> = ({ isOpen, onClose }) => {
    const [currentPath, setCurrentPath] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadCurrentPath();
        }
    }, [isOpen]);

    const loadCurrentPath = async () => {
        try {
            const path = await invoke<string>('get_current_report_dir');
            setCurrentPath(path);
        } catch (error) {
            console.error('获取当前路径失败:', error);
        }
    };

    const handleSelectFolder = async () => {
        try {
            setLoading(true);
            
            // 调用 Rust 命令打开目录选择对话框
            const selected = await invoke<string | null>('select_directory');
            
            if (selected) {
                const result = await invoke<string>('set_report_dir', { path: selected });
                console.log(result);
                setCurrentPath(selected);
                alert('日报保存路径已更新！');
            }
            
            setLoading(false);
        } catch (error) {
            console.error('选择目录失败:', error);
            alert(`设置失败: ${error}`);
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full mx-4 border border-white/60">
                <div className="mb-6">
                    <h3 className="text-2xl font-bold text-stone-800 mb-2">
                        📂 日报保存设置
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                        选择日报文件的保存位置。默认保存到文档目录下的 Chronicle/日报 文件夹。
                    </p>
                </div>

                <div className="mb-6 p-4 bg-stone-50 rounded-xl">
                    <div className="flex items-start gap-3">
                        <div className="text-2xl">📍</div>
                        <div className="flex-1">
                            <div className="text-xs font-bold text-stone-600 mb-2">
                                当前保存路径
                            </div>
                            <div className="text-sm text-stone-800 font-mono bg-white px-3 py-2 rounded-lg border border-stone-200 break-all">
                                {currentPath || '加载中...'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <button
                        onClick={handleSelectFolder}
                        disabled={loading}
                        className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>设置中...</span>
                            </>
                        ) : (
                            <>
                                <span>🗂️</span>
                                <span>选择新的保存目录</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6">
                    <p className="text-xs text-blue-700 leading-relaxed">
                        <span className="font-bold">💡 提示：</span> 
                        更改保存路径后，新生成的日报将保存到新路径中。
                        之前保存的日报文件不会被移动。
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-sm transition-colors"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};
