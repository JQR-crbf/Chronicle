import { ScreenpipeEvent } from '../types';

// Screenpipe API 基础 URL
const SCREENPIPE_API_BASE = 'http://localhost:3030';

/**
 * 检查 Screenpipe 服务是否运行
 */
export async function checkScreenpipeStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${SCREENPIPE_API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 搜索 Screenpipe 事件
 * @param options 搜索参数
 */
export async function searchScreenpipeEvents(options: {
  contentType?: 'all' | 'ocr' | 'audio' | 'ui';
  limit?: number;
  offset?: number;
  startTime?: Date;
  endTime?: Date;
  query?: string;
  appName?: string;
}): Promise<ScreenpipeEvent[]> {
  const {
    contentType = 'all',
    limit = 50,
    offset = 0,
    startTime,
    endTime,
    query,
    appName
  } = options;

  try {
    // 构建 Query String 参数（Screenpipe 使用 GET 请求）
    const params = new URLSearchParams();
    params.append('content_type', contentType);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    if (startTime) {
      params.append('start_time', startTime.toISOString());
    }
    if (endTime) {
      params.append('end_time', endTime.toISOString());
    }
    if (query) {
      params.append('q', query);
    }
    if (appName) {
      params.append('app_name', appName);
    }

    const url = `${SCREENPIPE_API_BASE}/search?${params.toString()}`;
    console.log('🔍 Screenpipe API 请求:', url);

    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Screenpipe API 错误: ${response.status}`);
      return [];
    }

    const data = await response.json();
    console.log(`✅ 获取到 ${data.data.length} 条记录，总共 ${data.pagination?.total || '?'} 条`);

    // 转换为应用的 ScreenpipeEvent 格式
    return data.data.map((item: any) => ({
      id: item.content.frame_id?.toString() || `e-${Date.now()}-${Math.random()}`,
      timestamp: item.content.timestamp,
      appName: item.content.app_name || 'Unknown',
      windowTitle: item.content.window_name || 'N/A',
      content: item.content.text || item.content.transcription || '',
      type: item.type,
      confidence: item.content.confidence
    }));
  } catch (error) {
    console.error('Screenpipe 连接失败:', error);
    return [];
  }
}

/**
 * 获取最近 N 小时的事件
 */
export async function getRecentEvents(hours: number = 8): Promise<ScreenpipeEvent[]> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

  return searchScreenpipeEvents({
    contentType: 'all',
    limit: 100,
    startTime,
    endTime
  });
}

/**
 * 根据日期和时间范围获取事件
 * @param date 日期（可以是 Date 对象或 YYYY-MM-DD 字符串）
 * @param startHour 开始小时（0-23，本地时间）
 * @param endHour 结束小时（0-23，本地时间）
 * @param appName 可选的应用名称筛选
 */
export async function getEventsByDateRange(
  date: Date | string,
  startHour: number = 0,
  endHour: number = 23,
  appName?: string
): Promise<ScreenpipeEvent[]> {
  // 如果是字符串（YYYY-MM-DD），解析为本地时间
  let localDate: Date;
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    localDate = new Date(year, month - 1, day); // month 是 0-based
  } else {
    localDate = new Date(date);
  }
  
  // 设置本地时间范围
  const startTime = new Date(localDate);
  startTime.setHours(startHour, 0, 0, 0);
  
  const endTime = new Date(localDate);
  endTime.setHours(endHour, 59, 59, 999);

  console.log('🕐 查询时间范围（本地时间）:', {
    date: typeof date === 'string' ? date : date.toISOString(),
    startLocal: startTime.toLocaleString('zh-CN'),
    endLocal: endTime.toLocaleString('zh-CN'),
    startUTC: startTime.toISOString(),
    endUTC: endTime.toISOString()
  });

  return searchScreenpipeEvents({
    contentType: 'all',
    limit: 10000,
    startTime,
    endTime,
    appName
  });
}

/**
 * 获取所有唯一的应用名称列表
 * @param startTime 开始时间
 * @param endTime 结束时间
 */
export async function getUniqueAppNames(startTime?: Date, endTime?: Date): Promise<string[]> {
  const events = await searchScreenpipeEvents({
    contentType: 'all',
    limit: 5000,
    startTime: startTime || new Date(Date.now() - 24 * 60 * 60 * 1000), // 默认最近24小时
    endTime: endTime || new Date()
  });

  // 提取唯一的应用名称
  const appNames = new Set(events.map(e => e.appName));
  return Array.from(appNames).sort();
}

/**
 * 获取今天的所有事件（本地时间）
 */
export async function getTodayEvents(): Promise<ScreenpipeEvent[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 本地时间 00:00
  
  const now = new Date(); // 当前时间

  console.log('🕐 查询今天的事件（本地时间）:', {
    startLocal: today.toLocaleString('zh-CN'),
    endLocal: now.toLocaleString('zh-CN'),
    startUTC: today.toISOString(),
    endUTC: now.toISOString()
  });

  return searchScreenpipeEvents({
    contentType: 'all',
    limit: 20000, // 增加限制以获取更多数据，避免只获取到最近的一小段时间
    startTime: today,
    endTime: now
  });
}

/**
 * 根据时间范围获取事件（用于任务上下文恢复）
 * @param centerTime 中心时间点
 * @param minutesBefore 前后多少分钟
 */
export async function getEventsAroundTime(
  centerTime: Date,
  minutesBefore: number = 30
): Promise<ScreenpipeEvent[]> {
  const startTime = new Date(centerTime.getTime() - minutesBefore * 60 * 1000);
  const endTime = new Date(centerTime.getTime() + minutesBefore * 60 * 1000);

  return searchScreenpipeEvents({
    contentType: 'all',
    limit: 50,
    startTime,
    endTime
  });
}

