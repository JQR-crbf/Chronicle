import { GoogleGenAI } from '@google/genai';
import { AISettings, AIClient } from '../types';
import { getModelName } from './aiSettings';

/**
 * OpenRouter API 客户端
 */
class OpenRouterClient implements AIClient {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // 将 Gemini 格式的 contents 转换为 OpenAI 格式的 messages
  private convertContents(contents: any): any[] {
    if (typeof contents === 'string') {
      return [{ role: 'user', content: contents }];
    }
    
    if (Array.isArray(contents)) {
      return contents.map((item: any) => {
        if (item.role && item.parts) {
          // Gemini 格式: { role, parts: [{ text }] }
          const text = item.parts.map((p: any) => p.text).join('\n');
          return {
            role: item.role === 'model' ? 'assistant' : item.role,
            content: text,
          };
        }
        return item;
      });
    }

    // 单个对象
    if (contents.role && contents.parts) {
      const text = contents.parts.map((p: any) => p.text).join('\n');
      return [{
        role: contents.role === 'model' ? 'assistant' : contents.role,
        content: text,
      }];
    }

    // 默认作为用户消息
    return [{ role: 'user', content: String(contents) }];
  }

  // 将 Gemini 类型转换为 OpenAI/JSON Schema 类型
  private convertType(type: any): string {
    if (typeof type === 'string') {
      return type.toLowerCase();
    }
    // Gemini 的 Type 枚举值（如 Type.STRING）通常是大写，需要转换为小写
    const typeStr = String(type).toLowerCase();
    return typeStr;
  }

  // 递归转换参数 schema
  private convertParameters(params: any): any {
    if (!params) return params;

    const result: any = { ...params };

    // 转换 type 字段
    if (result.type) {
      result.type = this.convertType(result.type);
    }

    // 递归处理 properties
    if (result.properties) {
      const convertedProps: any = {};
      for (const [key, value] of Object.entries(result.properties)) {
        const prop = value as any;
        convertedProps[key] = {
          ...prop,
          type: prop.type ? this.convertType(prop.type) : undefined,
        };
        // 保留其他字段如 description, enum 等
        if (prop.description) convertedProps[key].description = prop.description;
        if (prop.enum) convertedProps[key].enum = prop.enum;
      }
      result.properties = convertedProps;
    }

    return result;
  }

  async generateContent(params: { model: string; contents: any; config?: any }): Promise<any> {
    const messages = this.convertContents(params.contents);
    
    const body: any = {
      model: params.model,
      messages,
    };

    // 如果有系统指令，添加到消息开头
    if (params.config?.systemInstruction) {
      body.messages.unshift({
        role: 'system',
        content: typeof params.config.systemInstruction === 'string' 
          ? params.config.systemInstruction 
          : params.config.systemInstruction.parts?.[0]?.text || '',
      });
    }

    // 处理 tools (function calling)
    if (params.config?.tools && params.config.tools.length > 0) {
      // 将 Gemini 格式的 tools 转换为 OpenAI 格式
      const geminiTools = params.config.tools[0].functionDeclarations;
      body.tools = geminiTools.map((tool: any) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: this.convertParameters(tool.parameters),
        },
      }));
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Chronicle AI Task Manager',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`OpenRouter API 错误: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    
    // 构建兼容 Gemini 格式的响应
    const result: any = {
      text: message?.content || '',
    };

    // 如果有 function calls，转换为 Gemini 格式
    if (message?.tool_calls && message.tool_calls.length > 0) {
      result.functionCalls = message.tool_calls.map((toolCall: any) => ({
        name: toolCall.function.name,
        args: JSON.parse(toolCall.function.arguments),
      }));
    }
    
    return result;
  }

  // 流式生成（简化版，不支持真正的流式）
  async *generateContentStream(params: { model: string; contents: any }): AsyncGenerator<{ text: string }> {
    // OpenRouter 也支持流式，但为了简化，这里使用非流式然后模拟流式输出
    const result = await this.generateContent(params);
    yield { text: result.text };
  }
}

/**
 * Gemini API 客户端适配器
 */
class GeminiClientAdapter implements AIClient {
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateContent(params: { model: string; contents: any; config?: any }): Promise<any> {
    const response = await this.client.models.generateContent({
      model: params.model,
      contents: params.contents,
      config: params.config,
    });

    // 返回完整的响应对象，包括 functionCalls
    return response;
  }

  async *generateContentStream(params: { model: string; contents: any }): AsyncGenerator<{ text: string }> {
    const stream = await this.client.models.generateContentStream({
      model: params.model,
      contents: params.contents,
    });

    for await (const chunk of stream) {
      yield { text: chunk.text };
    }
  }
}

/**
 * 创建 AI 客户端
 */
export function createAIClient(settings: AISettings): AIClient {
  if (!settings.apiKey) {
    throw new Error('未配置 API Key，请在设置中配置');
  }

  if (settings.provider === 'openrouter') {
    console.log('🤖 使用 OpenRouter AI 客户端');
    return new OpenRouterClient(settings.apiKey);
  } else {
    console.log('🤖 使用 Gemini AI 客户端');
    return new GeminiClientAdapter(settings.apiKey);
  }
}

/**
 * 测试 AI 连接
 */
export async function testAIConnection(settings: AISettings): Promise<{ success: boolean; message: string }> {
  try {
    const client = createAIClient(settings);
    const model = getModelName(settings);
    
    console.log('🔍 测试 AI 连接...', { provider: settings.provider, model });

    const response = await client.generateContent({
      model,
      contents: '请回复：连接成功',
    });

    if (response.text && response.text.length > 0) {
      console.log('✅ AI 连接测试成功');
      return {
        success: true,
        message: '连接成功！AI 响应正常。',
      };
    } else {
      console.warn('⚠️ AI 返回空响应');
      return {
        success: false,
        message: 'AI 返回空响应，请检查配置。',
      };
    }
  } catch (error: any) {
    console.error('❌ AI 连接测试失败:', error);
    
    let message = 'AI 连接失败：';
    if (error.message?.includes('401') || error.message?.includes('API key')) {
      message += 'API Key 无效或没有权限';
    } else if (error.message?.includes('403')) {
      message += 'API Key 权限不足';
    } else if (error.message?.includes('429')) {
      message += 'API 请求频率超限，请稍后再试';
    } else if (error.message?.includes('insufficient')) {
      message += 'API 额度不足';
    } else {
      message += error.message || '未知错误';
    }
    
    return {
      success: false,
      message,
    };
  }
}
