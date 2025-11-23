import { ScreenpipeEvent } from '../types';

/**
 * 计算两个字符串的相似度（0-1）
 * 使用简化的 Jaccard 相似度算法
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  // 转为小写并分词
  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  if (tokens1.length === 0 && tokens2.length === 0) return 1;
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  // 计算 Jaccard 相似度
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * 将字符串分词（简单实现）
 */
function tokenize(str: string): string[] {
  // 移除特殊字符，转小写，按空格和标点分割
  return str
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // 保留中英文和数字
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * 合并后的事件（包含多个原始事件）
 */
export interface MergedEvent extends ScreenpipeEvent {
  mergedCount: number; // 合并了多少条记录
  originalEvents: ScreenpipeEvent[]; // 原始事件列表
  timeRange: {
    start: string; // 最早时间
    end: string;   // 最晚时间
  };
}

/**
 * 判断两个事件是否应该合并
 */
function shouldMerge(
  event1: ScreenpipeEvent,
  event2: ScreenpipeEvent,
  similarityThreshold: number = 0.8,
  timeWindowMinutes: number = 5
): boolean {
  // 1. 检查应用名称是否相同
  if (event1.appName !== event2.appName) {
    return false;
  }

  // 2. 检查时间窗口（默认5分钟内）
  const time1 = new Date(event1.timestamp).getTime();
  const time2 = new Date(event2.timestamp).getTime();
  const timeDiffMinutes = Math.abs(time1 - time2) / (1000 * 60);

  if (timeDiffMinutes > timeWindowMinutes) {
    return false;
  }

  // 3. 检查内容相似度
  const similarity = calculateSimilarity(event1.content, event2.content);

  console.log(`📊 相似度检查: ${event1.appName} | ${similarity.toFixed(2)} | ${timeDiffMinutes.toFixed(1)}min`, {
    content1: event1.content.substring(0, 30),
    content2: event2.content.substring(0, 30),
  });

  return similarity >= similarityThreshold;
}

/**
 * 合并相似的事件
 */
export function mergeEvents(
  events: ScreenpipeEvent[],
  options: {
    similarityThreshold?: number; // 相似度阈值，默认 0.8
    timeWindowMinutes?: number;   // 时间窗口（分钟），默认 5
  } = {}
): MergedEvent[] {
  const {
    similarityThreshold = 0.8,
    timeWindowMinutes = 5,
  } = options;

  console.log('🔄 开始合并事件...', {
    totalEvents: events.length,
    similarityThreshold,
    timeWindowMinutes,
  });

  if (events.length === 0) {
    return [];
  }

  // 🚫 过滤掉空内容的事件
  const filteredEvents = events.filter(event => {
    const hasContent = event.content && event.content.trim().length > 0;
    if (!hasContent) {
      console.log('🗑️ 过滤掉空内容事件:', {
        id: event.id,
        app: event.appName,
        timestamp: event.timestamp
      });
    }
    return hasContent;
  });

  console.log(`📊 过滤结果: ${events.length} → ${filteredEvents.length} 条记录`);

  if (filteredEvents.length === 0) {
    return [];
  }

  // 按时间排序（从早到晚）
  const sortedEvents = [...filteredEvents].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const mergedEvents: MergedEvent[] = [];
  const processed = new Set<string>(); // 已处理的事件 ID

  for (let i = 0; i < sortedEvents.length; i++) {
    const currentEvent = sortedEvents[i];

    // 如果已经被合并过，跳过
    if (processed.has(currentEvent.id)) {
      continue;
    }

    // 创建一个新的合并事件
    const mergedEvent: MergedEvent = {
      ...currentEvent,
      mergedCount: 1,
      originalEvents: [currentEvent],
      timeRange: {
        start: currentEvent.timestamp,
        end: currentEvent.timestamp,
      },
    };

    processed.add(currentEvent.id);

    // 查找后续相似的事件
    for (let j = i + 1; j < sortedEvents.length; j++) {
      const nextEvent = sortedEvents[j];

      // 如果已经被合并过，跳过
      if (processed.has(nextEvent.id)) {
        continue;
      }

      // 检查是否应该合并
      if (shouldMerge(currentEvent, nextEvent, similarityThreshold, timeWindowMinutes)) {
        mergedEvent.originalEvents.push(nextEvent);
        mergedEvent.mergedCount++;
        mergedEvent.timeRange.end = nextEvent.timestamp;
        processed.add(nextEvent.id);

        console.log(`✅ 合并事件: ${currentEvent.id} + ${nextEvent.id}`);
      }
    }

    // 如果合并了多条，更新内容为最长的那条
    if (mergedEvent.mergedCount > 1) {
      const longestContent = mergedEvent.originalEvents
        .map(e => e.content)
        .reduce((a, b) => a.length > b.length ? a : b);
      
      mergedEvent.content = longestContent;

      console.log(`📦 合并完成: ${mergedEvent.mergedCount} 条记录`, {
        id: mergedEvent.id,
        app: mergedEvent.appName,
        timeRange: `${new Date(mergedEvent.timeRange.start).toLocaleTimeString()} - ${new Date(mergedEvent.timeRange.end).toLocaleTimeString()}`,
      });
    }

    mergedEvents.push(mergedEvent);
  }

  const reductionRate = ((events.length - mergedEvents.length) / events.length * 100).toFixed(1);
  console.log('✅ 合并完成', {
    原始: events.length,
    合并后: mergedEvents.length,
    减少: `${reductionRate}%`,
  });

  return mergedEvents;
}

/**
 * 从 localStorage 加载合并配置
 */
export function loadMergeSettings(): {
  enabled: boolean;
  similarityThreshold: number;
  timeWindowMinutes: number;
} {
  try {
    const saved = localStorage.getItem('screenpipe_merge_settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('加载合并设置失败:', error);
  }

  return {
    enabled: true, // 默认启用
    similarityThreshold: 0.8,
    timeWindowMinutes: 5,
  };
}

/**
 * 保存合并配置到 localStorage
 */
export function saveMergeSettings(settings: {
  enabled: boolean;
  similarityThreshold: number;
  timeWindowMinutes: number;
}) {
  try {
    localStorage.setItem('screenpipe_merge_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('保存合并设置失败:', error);
  }
}

/**
 * 将合并后的事件缓存到 localStorage
 */
export function cacheMergedEvents(dateKey: string, events: MergedEvent[]) {
  try {
    const cache = JSON.parse(localStorage.getItem('screenpipe_merged_cache') || '{}');
    cache[dateKey] = {
      events,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem('screenpipe_merged_cache', JSON.stringify(cache));
    console.log('💾 已缓存合并结果:', dateKey);
  } catch (error) {
    console.error('缓存合并结果失败:', error);
  }
}

/**
 * 从 localStorage 加载缓存的合并事件
 */
export function loadCachedMergedEvents(dateKey: string): MergedEvent[] | null {
  try {
    const cache = JSON.parse(localStorage.getItem('screenpipe_merged_cache') || '{}');
    const cached = cache[dateKey];
    
    if (cached) {
      const cachedTime = new Date(cached.cachedAt).getTime();
      const now = new Date().getTime();
      const hoursPassed = (now - cachedTime) / (1000 * 60 * 60);
      
      // 解析日期键，检查是否为历史数据
      const dateMatch = dateKey.match(/^(\d{4}-\d{2}-\d{2})/);
      const isHistoricalData = dateMatch && dateMatch[1] !== new Date().toISOString().split('T')[0];

      // 智能缓存策略
      if (isHistoricalData) {
        // 历史数据：永久缓存（不会再变化）
        console.log('✅ 使用历史数据缓存:', dateKey);
        return cached.events;
      } else {
        // 今天的数据：缓存 24 小时（给足够的时间）
        if (hoursPassed < 24) {
          console.log('✅ 使用今日数据缓存:', dateKey, `(${hoursPassed.toFixed(1)}小时前)`);
          return cached.events;
        } else {
          console.log('⚠️ 今日数据缓存已过期:', dateKey);
        }
      }
    }
  } catch (error) {
    console.error('加载缓存的合并结果失败:', error);
  }

  return null;
}

/**
 * 清除合并事件缓存
 */
export function clearMergedCache() {
  try {
    localStorage.removeItem('screenpipe_merged_cache');
    console.log('🗑️ 已清除合并缓存');
  } catch (error) {
    console.error('清除缓存失败:', error);
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): {
  totalCached: number;
  totalSize: string;
  cacheKeys: Array<{ key: string; cachedAt: string; eventCount: number; isHistorical: boolean }>;
} {
  try {
    const cache = JSON.parse(localStorage.getItem('screenpipe_merged_cache') || '{}');
    const keys = Object.keys(cache);
    const today = new Date().toISOString().split('T')[0];

    const cacheKeys = keys.map(key => {
      const dateMatch = key.match(/^(\d{4}-\d{2}-\d{2})/);
      const isHistorical = dateMatch ? dateMatch[1] !== today : false;
      
      return {
        key,
        cachedAt: cache[key].cachedAt,
        eventCount: cache[key].events?.length || 0,
        isHistorical,
      };
    });

    // 计算缓存大小
    const cacheString = JSON.stringify(cache);
    const sizeKB = (cacheString.length / 1024).toFixed(2);

    return {
      totalCached: keys.length,
      totalSize: `${sizeKB} KB`,
      cacheKeys,
    };
  } catch (error) {
    console.error('获取缓存统计失败:', error);
    return {
      totalCached: 0,
      totalSize: '0 KB',
      cacheKeys: [],
    };
  }
}

/**
 * 清除过期缓存（仅清除今天的过期缓存，保留历史数据）
 */
export function clearExpiredCache() {
  try {
    const cache = JSON.parse(localStorage.getItem('screenpipe_merged_cache') || '{}');
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().getTime();
    let clearedCount = 0;

    Object.keys(cache).forEach(key => {
      const dateMatch = key.match(/^(\d{4}-\d{2}-\d{2})/);
      const isToday = dateMatch && dateMatch[1] === today;

      if (isToday) {
        const cachedTime = new Date(cache[key].cachedAt).getTime();
        const hoursPassed = (now - cachedTime) / (1000 * 60 * 60);

        if (hoursPassed >= 24) {
          delete cache[key];
          clearedCount++;
        }
      }
    });

    localStorage.setItem('screenpipe_merged_cache', JSON.stringify(cache));
    console.log(`🗑️ 已清除 ${clearedCount} 个过期缓存（保留历史数据）`);
    return clearedCount;
  } catch (error) {
    console.error('清除过期缓存失败:', error);
    return 0;
  }
}

