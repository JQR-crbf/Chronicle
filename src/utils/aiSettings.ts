import { AISettings, AIProvider } from '../types';

// AI 设置的 localStorage key
const AI_SETTINGS_KEY = 'ai_settings';

// 默认设置
export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  apiKey: '',
  model: undefined,
};

/**
 * 从 localStorage 加载 AI 设置
 */
export function loadAISettings(): AISettings {
  try {
    // 先尝试从 localStorage 读取
    const saved = localStorage.getItem(AI_SETTINGS_KEY);
    if (saved) {
      const settings = JSON.parse(saved) as AISettings;
      // 如果已保存设置，使用保存的设置
      if (settings.apiKey) {
        console.log('🔑 从 localStorage 加载 AI 设置:', {
          provider: settings.provider,
          hasKey: !!settings.apiKey,
          model: settings.model
        });
        return settings;
      }
    }

    // 如果没有保存的设置，尝试从环境变量读取 Gemini 密钥
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey) {
      console.log('🔑 从环境变量加载 Gemini API Key');
      return {
        provider: 'gemini',
        apiKey: envKey,
        model: undefined,
      };
    }

    // 都没有，返回默认空设置
    console.log('⚠️ 未找到 AI 设置，返回默认设置');
    return DEFAULT_AI_SETTINGS;
  } catch (error) {
    console.error('加载 AI 设置失败:', error);
    return DEFAULT_AI_SETTINGS;
  }
}

/**
 * 保存 AI 设置到 localStorage
 */
export function saveAISettings(settings: AISettings): void {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
    console.log('💾 AI 设置已保存:', {
      provider: settings.provider,
      hasKey: !!settings.apiKey,
      model: settings.model
    });
  } catch (error) {
    console.error('保存 AI 设置失败:', error);
  }
}

/**
 * 清除 AI 设置
 */
export function clearAISettings(): void {
  localStorage.removeItem(AI_SETTINGS_KEY);
  console.log('🗑️ AI 设置已清除');
}

/**
 * 获取当前使用的模型名称
 */
export function getModelName(settings: AISettings): string {
  if (settings.model) {
    return settings.model;
  }
  
  // 根据提供商返回默认模型
  if (settings.provider === 'gemini') {
    return 'gemini-2.5-flash';
  } else if (settings.provider === 'openrouter') {
    return 'openai/gpt-4o-mini';
  }
  
  return 'gemini-2.5-flash';
}
