import { ScreenpipeEvent, AIAnalysis, AIClient } from '../types';

// AI 分析存储的 localStorage key
const AI_ANALYSIS_STORAGE_KEY = 'screenpipe_ai_analysis';

/**
 * 使用 AI 分析 Screenpipe 事件内容
 */
export async function analyzeEventWithAI(
  event: ScreenpipeEvent,
  ai: AIClient,
  modelName: string
): Promise<AIAnalysis> {
  console.log('🔍 分析单个事件:', {
    id: event.id,
    app: event.appName,
    contentLength: event.content.length
  });

  try {
    const prompt = `
你是一个专业的内容分析助手。请分析以下屏幕捕获的内容：

**应用**: ${event.appName}
**窗口**: ${event.windowTitle}
**时间**: ${new Date(event.timestamp).toLocaleString('zh-CN')}
**类型**: ${event.type}
**内容**: 
${event.content}

请提供以下分析结果（JSON 格式）：
1. summary: 简短的内容摘要（20-50字）
2. keywords: 3-5个关键词数组
3. category: 分类（从以下选择：工作、学习、娱乐、沟通、其他）
4. importance: 重要性评分（1-5，5最重要）

返回格式示例：
{
  "summary": "在微信与同事讨论项目进度和需求细节",
  "keywords": ["微信", "项目讨论", "需求"],
  "category": "沟通",
  "importance": 4
}

只返回 JSON，不要其他文字。
    `.trim();

    console.log('📡 调用 AI...');
    const response = await ai.generateContent({
      model: modelName,
      contents: prompt,
    });

    const text = response.text.trim();
    console.log('📥 收到 API 响应:', text.substring(0, 100));
    
    // 提取 JSON（去除可能的 markdown 代码块标记）
    const jsonText = text.replace(/^```json\n?/i, '').replace(/\n?```$/i, '');
    const result = JSON.parse(jsonText);

    const analysis: AIAnalysis = {
      summary: result.summary || '无法生成摘要',
      keywords: Array.isArray(result.keywords) ? result.keywords : [],
      category: result.category || '其他',
      importance: Math.min(5, Math.max(1, result.importance || 3)),
      analyzedAt: new Date().toISOString(),
    };

    console.log('✅ 分析结果:', analysis);
    return analysis;
  } catch (error: any) {
    console.error('❌ AI 分析失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      event: { id: event.id, app: event.appName }
    });
    // 返回默认分析结果
    return {
      summary: '分析失败，请重试',
      keywords: [],
      category: '其他',
      importance: 3,
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * 批量分析多个事件
 */
export async function analyzeEventsInBatch(
  events: ScreenpipeEvent[],
  ai: AIClient,
  modelName: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, AIAnalysis>> {
  console.log('📦 开始批量分析:', { totalEvents: events.length });
  const results = new Map<string, AIAnalysis>();
  let analyzed = 0;
  let skipped = 0;
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // 如果已有分析结果，跳过
    if (event.aiAnalysis) {
      console.log(`⏭️  跳过已分析: ${event.id}`);
      results.set(event.id, event.aiAnalysis);
      skipped++;
      
      // 报告进度（跳过的也算进度）
      if (onProgress) {
        onProgress(i + 1, events.length);
      }
      continue;
    }

    console.log(`🔄 分析第 ${i + 1}/${events.length} 条...`);

    // 调用 AI 分析
    try {
      const analysis = await analyzeEventWithAI(event, ai, modelName);
      results.set(event.id, analysis);
      analyzed++;
      console.log(`✅ 第 ${i + 1} 条分析完成`);
    } catch (error) {
      console.error(`❌ 第 ${i + 1} 条分析失败:`, error);
      // 即使失败也继续分析下一条
    }

    // 报告进度
    if (onProgress) {
      onProgress(i + 1, events.length);
    }

    // 避免请求过快，每个请求间隔 500ms
    if (i < events.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('🏁 批量分析完成:', { 
    total: events.length, 
    analyzed, 
    skipped,
    results: results.size 
  });

  return results;
}

/**
 * 从 localStorage 加载 AI 分析结果
 */
export function loadAIAnalysisFromStorage(): Map<string, AIAnalysis> {
  try {
    const data = localStorage.getItem(AI_ANALYSIS_STORAGE_KEY);
    if (!data) return new Map();

    const obj = JSON.parse(data);
    return new Map(Object.entries(obj));
  } catch (error) {
    console.error('加载 AI 分析数据失败:', error);
    return new Map();
  }
}

/**
 * 保存 AI 分析结果到 localStorage
 */
export function saveAIAnalysisToStorage(analyses: Map<string, AIAnalysis>): void {
  try {
    const obj = Object.fromEntries(analyses);
    localStorage.setItem(AI_ANALYSIS_STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('保存 AI 分析数据失败:', error);
  }
}

/**
 * 合并事件和 AI 分析结果
 */
export function mergeEventsWithAnalysis(
  events: ScreenpipeEvent[],
  analyses: Map<string, AIAnalysis>
): ScreenpipeEvent[] {
  return events.map(event => ({
    ...event,
    aiAnalysis: analyses.get(event.id) || event.aiAnalysis,
  }));
}

/**
 * 清除所有 AI 分析数据
 */
export function clearAllAIAnalysis(): void {
  localStorage.removeItem(AI_ANALYSIS_STORAGE_KEY);
}

