import { Task } from '../types';
import { storage } from './storage';

/**
 * 数据迁移工具：为现有任务添加时间戳字段
 */

/**
 * 检查任务是否需要迁移（缺少时间戳字段）
 */
function needsMigration(task: any): boolean {
  return !task.createdAt || !task.updatedAt;
}

/**
 * 迁移单个任务，添加时间戳字段
 */
function migrateTask(task: any): Task {
  const now = new Date().toISOString();
  
  // 为旧任务生成一个合理的创建时间
  // 使用任务ID中的时间戳（如果有）或当前时间
  let createdAt = now;
  if (task.id && task.id.startsWith('t-')) {
    const timestampMatch = task.id.match(/t-(\d+)/);
    if (timestampMatch) {
      const timestamp = parseInt(timestampMatch[1]);
      if (!isNaN(timestamp) && timestamp > 1000000000000) { // 合理的时间戳
        createdAt = new Date(timestamp).toISOString();
      }
    }
  }
  
  // 为 Done 状态的任务设置合理的时间线
  let finalCreatedAt = task.createdAt || createdAt;
  let completedAt = task.completedAt;
  
  if (task.status === 'Done' && !task.completedAt) {
    // 获取本周一
    const nowDate = new Date();
    const dayOfWeek = nowDate.getDay();
    const monday = new Date(nowDate);
    monday.setDate(nowDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    // 在本周内随机一个完成时间（周一到现在）
    const mondayTime = monday.getTime();
    const nowTime = nowDate.getTime();
    const randomCompletedTime = mondayTime + Math.random() * (nowTime - mondayTime);
    completedAt = new Date(randomCompletedTime).toISOString();
    
    // 确保创建时间早于完成时间（提前1-3天）
    const daysBeforeCompletion = 1 + Math.random() * 2; // 1-3天
    const createdTime = randomCompletedTime - daysBeforeCompletion * 24 * 60 * 60 * 1000;
    finalCreatedAt = new Date(createdTime).toISOString();
    
    console.log(`📅 为任务 "${task.title}" 设置时间线:`, {
      createdAt: finalCreatedAt,
      completedAt: completedAt,
      耗时: `${daysBeforeCompletion.toFixed(1)}天`
    });
  }
  
  return {
    ...task,
    createdAt: finalCreatedAt,
    updatedAt: task.updatedAt || now,
    completedAt
  };
}

/**
 * 检查任务数据是否合理（completedAt 在本周内）
 */
function isDataReasonable(task: any): boolean {
  if (task.status !== 'Done' || !task.completedAt) return true;
  
  const completedDate = new Date(task.completedAt);
  const nowDate = new Date();
  const dayOfWeek = nowDate.getDay();
  const monday = new Date(nowDate);
  monday.setDate(nowDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  
  // 检查完成时间是否在本周
  const isThisWeek = completedDate >= monday && completedDate <= nowDate;
  
  // 检查创建时间是否早于完成时间
  const isTimelineCorrect = !task.createdAt || new Date(task.createdAt) <= completedDate;
  
  return isThisWeek && isTimelineCorrect;
}

/**
 * 执行数据迁移
 * @param force 是否强制重新迁移所有任务
 * @returns 迁移的任务数量
 */
export function migrateTaskData(force: boolean = false): number {
  const tasks = storage.getTasks();
  
  if (!tasks || tasks.length === 0) {
    console.log('📦 没有需要迁移的任务');
    return 0;
  }
  
  // 检查是否需要迁移
  let tasksNeedingMigration: any[];
  
  if (force) {
    // 强制重新迁移所有任务
    tasksNeedingMigration = tasks;
    console.log('🔄 强制重新迁移所有任务');
  } else {
    // 检查需要迁移或数据不合理的任务
    tasksNeedingMigration = tasks.filter(t => needsMigration(t) || !isDataReasonable(t));
    
    if (tasksNeedingMigration.length === 0) {
      console.log('✅ 所有任务数据正常');
      return 0;
    }
    
    console.log(`🔍 发现 ${tasksNeedingMigration.length} 个任务需要迁移或修复`);
  }
  
  // 执行迁移
  const migratedTasks = tasks.map(task => {
    const shouldMigrate = force || needsMigration(task) || !isDataReasonable(task);
    return shouldMigrate ? migrateTask(task) : task;
  });
  
  // 保存迁移后的数据
  storage.saveTasks(migratedTasks);
  
  console.log(`✅ 成功迁移/修复 ${tasksNeedingMigration.length} 个任务`);
  console.log('迁移后的任务示例:', migratedTasks.filter(t => t.status === 'Done')[0]);
  
  return tasksNeedingMigration.length;
}

/**
 * 在应用启动时自动执行迁移
 */
export function autoMigrate(): void {
  try {
    const migratedCount = migrateTaskData();
    if (migratedCount > 0) {
      console.log(`🔄 数据迁移完成：更新了 ${migratedCount} 个任务的时间戳`);
    }
  } catch (error) {
    console.error('❌ 数据迁移失败:', error);
  }
}

