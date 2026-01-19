import { ScreenpipeEvent } from '../types';

// 应用分类映射
const APP_CATEGORIES = {
  // 深度工作 - 编码和开发
  deepWork: [
    'Visual Studio Code', 'VSCode', 'VS Code', 'Code', 'code',
    'WebStorm', 'IntelliJ IDEA', 'PyCharm', 'Android Studio',
    'Xcode', 'Eclipse', 'Sublime Text', 'Atom', 'Vim', 'Emacs',
    'Cursor', 'cursor', 'Terminal', 'iTerm2', 'Warp',
    'Postman', 'Insomnia', 'TablePlus', 'Sequel Pro',
    'Docker', 'Figma', 'figma', 'Sketch', 'Adobe XD',
    'Notion', 'Obsidian', 'Typora', 'Bear', 'Ulysses',
    'Microsoft Word', 'Pages', 'Excel', 'Numbers'
  ],
  
  // 会议沟通
  communication: [
    'Slack', 'slack', 'Microsoft Teams', 'Teams',
    'Zoom', 'zoom.us', 'Google Meet', 'Meet',
    'Skype', 'Discord', 'WeChat', '微信', 'DingTalk', '钉钉',
    'Feishu', '飞书', 'Lark', 'Telegram',
    'Mail', 'Outlook', 'Gmail', 'Thunderbird', 'Spark'
  ],
  
  // 休息摸鱼
  leisure: [
    'YouTube', 'Netflix', 'Bilibili', '哔哩哔哩',
    'Twitter', 'X', 'Facebook', 'Instagram', 'TikTok', '抖音',
    'Reddit', 'Zhihu', '知乎', 'V2EX', 'Weibo', '微博',
    'Steam', 'Epic Games', 'League of Legends', 'Game',
    'Music', 'Spotify', 'Apple Music', 'QQ音乐', '网易云音乐',
    'Safari', 'Chrome', 'Firefox', 'Edge' // 浏览器需要根据内容进一步判断
  ]
};

// 判断应用类型
export function categorizeApp(appName: string, windowTitle?: string): 'deepWork' | 'communication' | 'leisure' | 'unknown' {
  const lowerApp = appName.toLowerCase();
  const lowerWindow = windowTitle?.toLowerCase() || '';
  
  // 检查深度工作
  if (APP_CATEGORIES.deepWork.some(app => lowerApp.includes(app.toLowerCase()))) {
    return 'deepWork';
  }
  
  // 检查沟通
  if (APP_CATEGORIES.communication.some(app => lowerApp.includes(app.toLowerCase()))) {
    return 'communication';
  }
  
  // 浏览器需要特殊处理
  if (lowerApp.includes('chrome') || lowerApp.includes('safari') || lowerApp.includes('firefox') || lowerApp.includes('edge')) {
    // 根据窗口标题判断
    const productiveKeywords = ['github', 'stackoverflow', 'mdn', 'docs', 'documentation', 'api', 'tutorial', 'dev'];
    const leisureKeywords = ['youtube', 'netflix', 'bilibili', 'twitter', 'facebook', 'instagram', 'reddit'];
    
    if (productiveKeywords.some(kw => lowerWindow.includes(kw))) {
      return 'deepWork';
    }
    if (leisureKeywords.some(kw => lowerWindow.includes(kw))) {
      return 'leisure';
    }
  }
  
  // 检查休闲
  if (APP_CATEGORIES.leisure.some(app => lowerApp.includes(app.toLowerCase()))) {
    return 'leisure';
  }
  
  return 'unknown';
}

// 计算两个时间戳的分钟差
function getMinutesDiff(time1: string, time2: string): number {
  return Math.abs(new Date(time1).getTime() - new Date(time2).getTime()) / (1000 * 60);
}

// 按应用聚合时长
export interface AppUsage {
  appName: string;
  totalMinutes: number;
  percentage: number;
  category: 'deepWork' | 'communication' | 'leisure' | 'unknown';
  icon: string;
}

// 根据应用名称获取图标
function getAppIcon(appName: string): string {
  const lowerApp = appName.toLowerCase();
  
  if (lowerApp.includes('code') || lowerApp.includes('cursor')) return '💻';
  if (lowerApp.includes('chrome') || lowerApp.includes('safari') || lowerApp.includes('firefox')) return '🌐';
  if (lowerApp.includes('slack') || lowerApp.includes('teams') || lowerApp.includes('wechat') || lowerApp.includes('微信')) return '💬';
  if (lowerApp.includes('terminal') || lowerApp.includes('iterm')) return '⌨️';
  if (lowerApp.includes('figma') || lowerApp.includes('sketch')) return '🎨';
  if (lowerApp.includes('zoom') || lowerApp.includes('meet')) return '📹';
  if (lowerApp.includes('mail') || lowerApp.includes('outlook')) return '📧';
  if (lowerApp.includes('notion') || lowerApp.includes('obsidian')) return '📝';
  if (lowerApp.includes('music') || lowerApp.includes('spotify')) return '🎵';
  if (lowerApp.includes('youtube') || lowerApp.includes('bilibili')) return '📺';
  
  return '📱';
}

// 今日工作概览数据
export interface TodayOverview {
  workHours: number;
  deepWorkHours: number;
  tasksCompleted: number;
  focusScore: number;
}

// 时间分布数据
export interface TimeDistribution {
  deepWork: { hours: number; percent: number };
  communication: { hours: number; percent: number };
  leisure: { hours: number; percent: number };
}

// 专注时段分析
export interface FocusPeriod {
  timeRange: string;
  type: 'best' | 'worst';
  avgContinuousMinutes: number;
  switchCount: number;
  description: string;
}

// 每小时统计
interface HourlyStats {
  hour: number;
  focusScore: number;
  switches: number;
  duration: number;
  category: 'deepWork' | 'communication' | 'leisure' | 'unknown';
}

// 分析今日数据
export function analyzeTodayEvents(events: ScreenpipeEvent[]) {
  if (events.length === 0) {
    return {
      overview: {
        workHours: 0,
        deepWorkHours: 0,
        tasksCompleted: 0,
        focusScore: 0
      },
      timeDistribution: {
        deepWork: { hours: 0, percent: 0 },
        communication: { hours: 0, percent: 0 },
        leisure: { hours: 0, percent: 0 }
      },
      appUsage: [],
      focusPeriods: []
    };
  }

  // 按时间排序
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // 1. 计算总工作时长和各类别时长
  const categoryMinutes: Record<string, number> = {
    deepWork: 0,
    communication: 0,
    leisure: 0,
    unknown: 0
  };

  const appMinutes = new Map<string, number>();
  
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];
    const minutesDiff = getMinutesDiff(current.timestamp, next.timestamp);
    
    // 如果间隔超过5分钟，认为是休息时间，不计入
    if (minutesDiff <= 5) {
      const category = categorizeApp(current.appName, current.windowTitle);
      categoryMinutes[category] += minutesDiff;
      
      // 按应用统计
      const existingMinutes = appMinutes.get(current.appName) || 0;
      appMinutes.set(current.appName, existingMinutes + minutesDiff);
    }
  }

  const totalMinutes = Object.values(categoryMinutes).reduce((a, b) => a + b, 0);
  const workHours = totalMinutes / 60;
  const deepWorkHours = categoryMinutes.deepWork / 60;

  // 2. 计算时间分布百分比
  const timeDistribution: TimeDistribution = {
    deepWork: {
      hours: parseFloat(deepWorkHours.toFixed(1)),
      percent: totalMinutes > 0 ? Math.round((categoryMinutes.deepWork / totalMinutes) * 100) : 0
    },
    communication: {
      hours: parseFloat((categoryMinutes.communication / 60).toFixed(1)),
      percent: totalMinutes > 0 ? Math.round((categoryMinutes.communication / totalMinutes) * 100) : 0
    },
    leisure: {
      hours: parseFloat((categoryMinutes.leisure / 60).toFixed(1)),
      percent: totalMinutes > 0 ? Math.round((categoryMinutes.leisure / totalMinutes) * 100) : 0
    }
  };

  // 3. 应用使用排行
  const appUsage: AppUsage[] = Array.from(appMinutes.entries())
    .map(([appName, minutes]) => ({
      appName,
      totalMinutes: minutes,
      percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
      category: categorizeApp(appName),
      icon: getAppIcon(appName)
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 5);

  // 4. 计算专注度（基于窗口切换频率）
  const uniqueApps = new Set(sortedEvents.map(e => e.appName));
  const switchCount = sortedEvents.length;
  const focusScore = Math.min(100, Math.max(0, 100 - (switchCount / totalMinutes * 100)));

  // 5. 专注时段分析 - 按小时分组
  const hourlyStats: HourlyStats[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourEvents = sortedEvents.filter(e => new Date(e.timestamp).getHours() === hour);
    if (hourEvents.length > 0) {
      const hourMinutes = hourEvents.reduce((sum, e, idx) => {
        if (idx < hourEvents.length - 1) {
          const diff = getMinutesDiff(e.timestamp, hourEvents[idx + 1].timestamp);
          return diff <= 5 ? sum + diff : sum;
        }
        return sum;
      }, 0);
      
      const mainCategory = categorizeApp(hourEvents[0].appName, hourEvents[0].windowTitle);
      
      hourlyStats.push({
        hour,
        focusScore: hourEvents.length > 0 ? Math.max(0, 100 - hourEvents.length) : 0,
        switches: hourEvents.length,
        duration: hourMinutes,
        category: mainCategory
      });
    }
  }

  // 找出最佳和最差时段
  const focusPeriods: FocusPeriod[] = [];
  if (hourlyStats.length > 0) {
    const sortedByFocus = [...hourlyStats].sort((a, b) => b.focusScore - a.focusScore);
    const best = sortedByFocus[0];
    const worst = sortedByFocus[sortedByFocus.length - 1];
    
    if (best) {
      focusPeriods.push({
        timeRange: `${best.hour}:00-${best.hour + 1}:00`,
        type: 'best',
        avgContinuousMinutes: best.duration,
        switchCount: best.switches,
        description: '平均连续工作较长，切换次数少'
      });
    }
    
    if (worst && worst.hour !== best?.hour) {
      focusPeriods.push({
        timeRange: `${worst.hour}:00-${worst.hour + 1}:00`,
        type: 'worst',
        avgContinuousMinutes: worst.duration,
        switchCount: worst.switches,
        description: '频繁切换窗口，建议安排轻度任务'
      });
    }
  }

  const overview: TodayOverview = {
    workHours: parseFloat(workHours.toFixed(1)),
    deepWorkHours: parseFloat(deepWorkHours.toFixed(1)),
    tasksCompleted: 0, // 注意：这个值需要在调用处单独设置，从任务系统获取
    focusScore: Math.round(focusScore)
  };

  return {
    overview,
    timeDistribution,
    appUsage,
    focusPeriods
  };
}

// 计算RPG属性
export interface RPGStats {
  level: number;
  title: string;
  strength: number;  // 代码力
  charisma: number;  // 沟通力
  wisdom: number;    // 专注度
  chaos: number;     // 摸鱼值
  xp: number;
  nextLevelXp: number;
}

export function calculateRPGStats(events: ScreenpipeEvent[], historicalTotalHours: number = 0): RPGStats {
  const analysis = analyzeTodayEvents(events);
  const { timeDistribution, overview } = analysis;
  
  const totalHours = overview.workHours + historicalTotalHours;
  const level = Math.floor(totalHours / 10) + 1;
  
  // 计算属性 (0-100)
  const strength = Math.min(100, timeDistribution.deepWork.percent);
  const charisma = Math.min(100, timeDistribution.communication.percent);
  const wisdom = Math.min(100, overview.focusScore);
  const chaos = Math.min(100, timeDistribution.leisure.percent);
  
  // 根据主导属性确定称号
  let title = "职场新人";
  if (level >= 10) {
    const maxStat = Math.max(strength, charisma, wisdom);
    if (maxStat === strength && strength > 70) {
      title = "代码魔导师";
    } else if (maxStat === charisma && charisma > 70) {
      title = "沟通大师";
    } else if (maxStat === wisdom && wisdom > 70) {
      title = "专注贤者";
    } else {
      title = "全能战士";
    }
  } else if (level >= 5) {
    title = "进阶打工人";
  }
  
  return {
    level,
    title,
    strength: Math.round(strength),
    charisma: Math.round(charisma),
    wisdom: Math.round(wisdom),
    chaos: Math.round(chaos),
    xp: Math.round(totalHours * 10),
    nextLevelXp: (level + 1) * 100
  };
}

// 获取本周的事件
export async function getWeekEvents(): Promise<ScreenpipeEvent[]> {
  // 获取本周一 00:00
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  
  // 动态导入避免循环依赖
  const { searchScreenpipeEvents } = await import('./screenpipe');
  
  return searchScreenpipeEvents({
    contentType: 'all',
    limit: 50000, // 增加限制以获取更多数据
    startTime: monday,
    endTime: now
  });
}

// 获取过去7天每天的完成任务数
// 注意：此函数已弃用，请使用 taskAnalyzer.ts 中的 getWeeklyTaskTrend()
export function getWeeklyTaskTrend(): number[] {
  console.warn('⚠️ insightsAnalyzer.getWeeklyTaskTrend() 已弃用，请使用 taskAnalyzer.getWeeklyTaskTrend()');
  return [2, 3, 2, 4, 3, 5, 4];
}

