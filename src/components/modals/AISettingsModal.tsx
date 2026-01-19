import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { AISettings, AIProvider } from '../../types';
import { testAIConnection } from '../../utils/aiClient';
import { getModelName } from '../../utils/aiSettings';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
}

const PROVIDER_INFO = {
  gemini: {
    name: 'Google Gemini',
    icon: '🤖',
    description: 'Google 官方 AI 服务',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.5-flash',
    modelOptions: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (快速)' },
      { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (高级)' },
    ],
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🔀',
    description: '统一 AI 模型接口平台',
    getKeyUrl: 'https://openrouter.ai/keys',
    defaultModel: 'openai/gpt-4o-mini',
    modelOptions: [
      // OpenAI 系列
      { value: 'openai/gpt-4o-mini', label: '⚡️ GPT-4o Mini (推荐，性价比高)' },
      { value: 'openai/gpt-4o', label: 'GPT-4o (强大)' },
      { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
      
      // Google Gemini 3.x 系列（最新）
      { value: 'google/gemini-3-pro-preview', label: '🌟 Gemini 3 Pro Preview (预览版)' },
      { value: 'google/gemini-3-flash-preview', label: '🌟 Gemini 3 Flash Preview (预览版)' },
      
      // Google Gemini 2.5 系列
      { value: 'google/gemini-2.5-pro', label: '⭐️ Gemini 2.5 Pro (最强)' },
      { value: 'google/gemini-2.5-flash', label: '⚡️ Gemini 2.5 Flash (快速)' },
      { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (轻量)' },
      
      // Google Gemini 2.0 系列
      { value: 'google/gemini-2.0-flash-lite-001', label: 'Gemini 2.0 Flash Lite' },
      
      // Google Gemini 1.5 系列
      { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5' },
      { value: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5' },
      { value: 'google/gemini-flash-1.5-8b', label: 'Gemini Flash 1.5 8B' },
      
      // Anthropic Claude 系列
      { value: 'anthropic/claude-3.5-sonnet', label: '⭐️ Claude 3.5 Sonnet (质量最高)' },
      { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus (旗舰)' },
      { value: 'anthropic/claude-3-sonnet', label: 'Claude 3 Sonnet' },
      { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku (快速)' },
      
      // 免费模型
      { value: 'google/gemini-2.0-flash-exp:free', label: '🆓 Gemini 2.0 Flash Exp (免费，可能限流)' },
      { value: 'qwen/qwen-2-7b-instruct:free', label: '🆓 Qwen 2 7B (免费，中文好)' },
      { value: 'meta-llama/llama-3.2-3b-instruct:free', label: '🆓 Llama 3.2 3B (免费)' },
      { value: 'microsoft/phi-3-mini-128k-instruct:free', label: '🆓 Phi 3 Mini (免费)' },
    ],
  },
};

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setTestResult(null);
  }, [settings, isOpen]);

  const handleProviderChange = (provider: AIProvider) => {
    const providerInfo = PROVIDER_INFO[provider];
    setLocalSettings({
      provider,
      apiKey: localSettings.apiKey,
      model: providerInfo.defaultModel,
    });
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!localSettings.apiKey.trim()) {
      setTestResult({
        success: false,
        message: '请先输入 API Key',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const result = await testAIConnection(localSettings);
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    if (!localSettings.apiKey.trim()) {
      setTestResult({
        success: false,
        message: '请先输入 API Key',
      });
      return;
    }

    onSave(localSettings);
    onClose();
  };

  const handleClearSettings = () => {
    console.log('🗑️ 开始清除配置...');
    try {
      // 清除 AI 设置
      localStorage.removeItem('ai_settings');
      console.log('✅ AI 设置已清除');
      
      // 显示成功消息
      setTestResult({
        success: true,
        message: '配置已清除！请关闭此窗口并重新打开。',
      });
      
      setShowClearConfirm(false);
      
      // 3秒后刷新页面
      setTimeout(() => {
        console.log('🔄 正在刷新页面...');
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('❌ 清除配置失败:', error);
      setTestResult({
        success: false,
        message: '清除配置失败，请手动刷新页面。',
      });
    }
  };

  const providerInfo = PROVIDER_INFO[localSettings.provider];
  const currentModel = getModelName(localSettings);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-2xl">
        <h2 className="text-xl font-bold text-stone-800 mb-6">🤖 AI 设置</h2>

        {/* AI 提供商选择 */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-stone-700 mb-3">选择 AI 提供商</h3>
          
          <div className="space-y-3">
            {/* Gemini */}
            <label 
              className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors"
              style={{
                borderColor: localSettings.provider === 'gemini' ? '#10b981' : '#e7e5e4'
              }}
            >
              <input
                type="radio"
                name="provider"
                value="gemini"
                checked={localSettings.provider === 'gemini'}
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-bold text-stone-800 mb-1">
                  {PROVIDER_INFO.gemini.icon} {PROVIDER_INFO.gemini.name}
                </div>
                <div className="text-xs text-stone-600">
                  {PROVIDER_INFO.gemini.description}
                </div>
              </div>
            </label>

            {/* OpenRouter */}
            <label 
              className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors"
              style={{
                borderColor: localSettings.provider === 'openrouter' ? '#10b981' : '#e7e5e4'
              }}
            >
              <input
                type="radio"
                name="provider"
                value="openrouter"
                checked={localSettings.provider === 'openrouter'}
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-bold text-stone-800 mb-1">
                  {PROVIDER_INFO.openrouter.icon} {PROVIDER_INFO.openrouter.name}
                </div>
                <div className="text-xs text-stone-600">
                  {PROVIDER_INFO.openrouter.description}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* API Key 输入 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-bold text-stone-700">
              API Key
            </label>
            <a
              href={providerInfo.getKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              🔗 获取 API Key
            </a>
          </div>
          
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={localSettings.apiKey}
              onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
              placeholder={`请输入 ${providerInfo.name} API Key`}
              className="w-full px-3 py-2 pr-20 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-700 px-2 py-1"
            >
              {showApiKey ? '🙈 隐藏' : '👁️ 显示'}
            </button>
          </div>
          
          <div className="mt-2 text-xs text-stone-500">
            💡 API Key 将安全地保存在本地，不会上传到服务器
          </div>
        </div>

        {/* 模型选择 */}
        <div className="mb-6">
          <label className="text-sm font-bold text-stone-700 mb-2 block">
            选择模型
          </label>
          <select
            value={localSettings.model || providerInfo.defaultModel}
            onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {providerInfo.modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-stone-500">
            当前模型：<code className="bg-stone-100 px-2 py-0.5 rounded">{currentModel}</code>
          </div>
        </div>

        {/* 测试连接 */}
        <div className="mb-6">
          <button
            onClick={handleTest}
            disabled={testing || !localSettings.apiKey.trim()}
            className="w-full px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed"
          >
            {testing ? '🔄 测试中...' : '🧪 测试连接'}
          </button>
          
          {testResult && (
            <div 
              className={`mt-3 p-3 rounded-lg text-sm ${
                testResult.success 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {testResult.success ? '✅' : '❌'} {testResult.message}
            </div>
          )}
        </div>

        {/* 按钮 */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors"
            >
              💾 保存设置
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-stone-200 text-stone-700 font-bold rounded-lg hover:bg-stone-300 transition-colors"
            >
              取消
            </button>
          </div>
          
          {/* 清除配置按钮 */}
          {!showClearConfirm ? (
            <button
              onClick={() => {
                console.log('🗑️ 点击了清除按钮');
                setShowClearConfirm(true);
              }}
              className="w-full px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-lg hover:bg-red-100 transition-colors border border-red-200"
            >
              🗑️ 清除配置并重启
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleClearSettings}
                className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors"
              >
                ✓ 确认清除
              </button>
              <button
                onClick={() => {
                  console.log('❌ 取消清除');
                  setShowClearConfirm(false);
                }}
                className="flex-1 px-4 py-2 bg-stone-200 text-stone-700 text-sm font-bold rounded-lg hover:bg-stone-300 transition-colors"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-800">
            <div className="font-bold mb-2">💡 使用说明：</div>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Gemini</strong>：Google 官方服务，稳定可靠</li>
              <li><strong>OpenRouter</strong>：支持多种 AI 模型，灵活切换</li>
              <li>保存后即刻生效，无需重启应用</li>
              <li>建议先测试连接，确保 API Key 有效</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  );
};
