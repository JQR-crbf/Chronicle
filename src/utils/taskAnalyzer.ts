import { Task } from '../types';
import { storage } from './storage';

/**
 * ✅ 任务统计分析器
 * 
 * 已实现功能：
 * - ✅ 使用真实的 createdAt 和 completedAt 字段
 * - ✅ 精确计算完成耗时
 * - ✅ 按实际完成日期统计每日任务数
 * - ✅ 历史趋势对比（本周 vs 上周）
 * 
 * Task 接口包含的时间戳字段：
 * - createdAt: string    // 任务创建时间 (ISO 8601)
 * - completedAt?: string // 任务完成时间 (ISO 8601)
 * - updatedAt: string    // 最后更新时间 (ISO 8601)
 */

/**
 * 任务统计数据
 */
export interface TaskStats {
  weeklyCompleted: number;        // 本周完成任务数
  weeklyCompletedTrend: string;   // 趋势（如 "+15%"）
  avgCompletionDays: number;      // 平均完成耗时（天）
  avgTrend: string;               // 耗时趋势
  fastestCompletion: number;      // 最快完成时间（小时）
  fastestTaskTitle: string;       // 最快完成的任务标题
  inProgress: number;             // 进行中的任务数
  highPriorityInProgress: number; // 高优先级进行中任务数
  dailyCompletionCounts: number[]; // 本周每天完成数（周一到今天）
}

/**
 * 计算两个日期之间的天数差
 */
function getDaysDiff(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * 计算两个日期之间的小时差
 */
function getHoursDiff(date1: Date, date2: Date): number {
  const diffMs = Math.abs(date2.getTime() - date1.getTime());
  return diffMs / (1000 * 60 * 60);
}

/**
 * 获取本周一的日期（00:00:00）
 */
function getThisWeekMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * 获取上周一的日期（00:00:00）
 */
function getLastWeekMonday(): Date {
  const thisMonday = getThisWeekMonday();
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  return lastMonday;
}

/**
 * 检查任务是否在本周完成
 */
function isCompletedThisWeek(task: Task): boolean {
  if (task.status !== 'Done' || !task.completedAt) return false;
  
  const completedDate = new Date(task.completedAt);
  const monday = getThisWeekMonday();
  const now = new Date();
  
  return completedDate >= monday && completedDate <= now;
}

/**
 * 检查任务是否在上周完成
 */
function isCompletedLastWeek(task: Task): boolean {
  if (task.status !== 'Done' || !task.completedAt) return false;
  
  const completedDate = new Date(task.completedAt);
  const lastMonday = getLastWeekMonday();
  const thisMonday = getThisWeekMonday();
  
  return completedDate >= lastMonday && completedDate < thisMonday;
}

/**
 * 分析任务数据，生成统计信息
 */
export async function analyzeTaskStats(): Promise<TaskStats> {
  const tasks = await storage.getTasks() || [];
  
  console.log('📊 开始分析任务统计:', {
    totalTasks: tasks.length,
    doneTasks: tasks.filter(t => t.status === 'Done').length,
    thisWeekMonday: getThisWeekMonday().toISOString(),
    now: new Date().toISOString()
  });
  
  // 1. 统计本周完成的任务
  const thisWeekCompleted = tasks.filter(isCompletedThisWeek);
  const lastWeekCompleted = tasks.filter(isCompletedLastWeek);
  
  console.log('✅ 本周完成的任务:', thisWeekCompleted.map(t => ({
    id: t.id,
    title: t.title,
    completedAt: t.completedAt,
    status: t.status
  })));
  
  const weeklyCompletedCount = thisWeekCompleted.length;
  const lastWeekCount = lastWeekCompleted.length;
  
  // 计算趋势百分比
  let weeklyTrend: string;
  if (lastWeekCount === 0) {
    // 上周没有完成任务
    if (weeklyCompletedCount === 0) {
      weeklyTrend = '0%';
    } else {
      weeklyTrend = `+${weeklyCompletedCount}个`; // 显示新增个数
    }
  } else {
    // 正常计算百分比
    const percentChange = Math.round(((weeklyCompletedCount - lastWeekCount) / lastWeekCount) * 100);
    weeklyTrend = `${percentChange > 0 ? '+' : ''}${percentChange}%`;
  }
  
  // 2. 计算平均完成耗时
  let avgCompletionDays = 0;
  let avgTrend = '-0天';
  
  if (thisWeekCompleted.length > 0) {
    const completionTimes = thisWeekCompleted
      .filter(t => t.createdAt && t.completedAt)
      .map(t => {
        const days = getDaysDiff(new Date(t.createdAt), new Date(t.completedAt!));
        console.log(`任务 "${t.title}" 耗时: ${days.toFixed(2)}天`, {
          createdAt: t.createdAt,
          completedAt: t.completedAt
        });
        return days;
      });
    
    if (completionTimes.length > 0) {
      avgCompletionDays = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
      console.log(`平均完成耗时: ${avgCompletionDays.toFixed(2)}天`, completionTimes);
      
      // 计算上周的平均耗时来对比
      if (lastWeekCompleted.length > 0) {
        const lastWeekTimes = lastWeekCompleted
          .filter(t => t.createdAt && t.completedAt)
          .map(t => getDaysDiff(new Date(t.createdAt), new Date(t.completedAt!)));
        
        if (lastWeekTimes.length > 0) {
          const lastAvg = lastWeekTimes.reduce((a, b) => a + b, 0) / lastWeekTimes.length;
          const diff = avgCompletionDays - lastAvg;
          avgTrend = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}天`;
        }
      }
    }
  }
  
  // 3. 最快完成的任务
  let fastestCompletion = 0;
  let fastestTaskTitle = '-';
  
  if (thisWeekCompleted.length > 0) {
    const tasksWithTimes = thisWeekCompleted
      .filter(t => t.createdAt && t.completedAt)
      .map(t => ({
        task: t,
        hours: getHoursDiff(new Date(t.createdAt), new Date(t.completedAt!))
      }))
      .sort((a, b) => a.hours - b.hours);
    
    if (tasksWithTimes.length > 0) {
      const fastest = tasksWithTimes[0];
      fastestCompletion = Math.max(1, Math.round(fastest.hours));
      fastestTaskTitle = fastest.task.title.substring(0, 10);
    }
  }
  
  // 4. 进行中的任务
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress');
  const highPriorityInProgress = inProgressTasks.filter(t => t.priority === 'High').length;
  
  // 5. 本周每天的完成数（周一到今天）
  const monday = getThisWeekMonday();
  const today = new Date();
  const daysInWeek = 7;
  const dailyCompletionCounts: number[] = new Array(daysInWeek).fill(0);
  
  // 统计每天的实际完成数
  thisWeekCompleted.forEach(task => {
    if (task.completedAt) {
      const completedDate = new Date(task.completedAt);
      // 计算是周几（0=周一, 6=周日）
      const dayOfWeek = completedDate.getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 周日=6, 周一=0
      
      // 确保在有效范围内
      if (dayIndex >= 0 && dayIndex < daysInWeek) {
        dailyCompletionCounts[dayIndex]++;
      }
    }
  });
  
  console.log('📊 任务完成数分布（真实数据）:', {
    weeklyCompleted: weeklyCompletedCount,
    thisWeekCompletedTasks: thisWeekCompleted.map(t => ({
      title: t.title,
      completedAt: t.completedAt
    })),
    dailyCompletionCounts,
    today: today.toDateString()
  });
  
  return {
    weeklyCompleted: weeklyCompletedCount,
    weeklyCompletedTrend: weeklyTrend,
    avgCompletionDays,
    avgTrend,
    fastestCompletion,
    fastestTaskTitle,
    inProgress: inProgressTasks.length,
    highPriorityInProgress,
    dailyCompletionCounts
  };
}

/**
 * 获取本周任务完成趋势（用于柱状图）
 * 返回7个数字，代表周一到周日的完成任务数
 */
export async function getWeeklyTaskTrend(): Promise<number[]> {
  const stats = await analyzeTaskStats();
  return stats.dailyCompletionCounts;
}

/**
 * 将完成数转换为柱状图高度百分比
 * @param counts 每天的完成数
 * @returns 每天的高度百分比（0-100）
 */
export function convertToChartHeights(counts: number[]): number[] {
  if (counts.length === 0) return [];
  
  const maxCount = Math.max(...counts, 1); // 避免除以0
  
  return counts.map(count => {
    if (count === 0) return 0;
    // 至少显示20%，最多100%
    const percentage = (count / maxCount) * 100;
    return Math.max(20, Math.min(100, percentage));
  });
}

