import Database from '@tauri-apps/plugin-sql';
import { Task } from '../types';

// 报告类型定义
export type ReportType = 'daily' | 'weekly' | 'daily_leader' | 'ai_insight';

let db: Database | null = null;

/**
 * 初始化数据库连接
 */
export async function initDatabase(): Promise<void> {
  try {
    db = await Database.load('sqlite:chronicle.db');
    
    // 创建任务表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        tags TEXT,
        subtasks TEXT,
        dueDate TEXT,
        storyPoints INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        completedAt TEXT,
        embedding TEXT
      )
    `);
    
    // 创建报告表（日报和周报）
    await db.execute(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(type, date)
      )
    `);
    
    // 创建每日统计表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        workHours REAL,
        deepWorkHours REAL,
        tasksCompleted INTEGER,
        focusScore INTEGER,
        timeDistribution TEXT,
        appUsage TEXT,
        focusPeriods TEXT,
        rpgStats TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    
    // 🔧 数据库表结构升级：添加缺失的列
    await upgradeDatabase();
    
    console.log('✅ 数据库初始化成功');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 升级数据库表结构（添加新列）
 */
async function upgradeDatabase(): Promise<void> {
  if (!db) return;
  
  try {
    // 检查 tasks 表是否有 embedding 列
    const tableInfo = await db.select<Array<{ name: string }>>(
      "PRAGMA table_info(tasks)"
    );
    
    const hasEmbedding = tableInfo.some(col => col.name === 'embedding');
    
    if (!hasEmbedding) {
      console.log('🔄 升级数据库：添加 embedding 列...');
      await db.execute('ALTER TABLE tasks ADD COLUMN embedding TEXT');
      console.log('✅ embedding 列添加成功');
    }
  } catch (error) {
    console.warn('⚠️ 数据库升级检查失败（可能是正常的）:', error);
    // 不抛出错误，因为可能是表不存在等正常情况
  }
}

/**
 * 获取所有任务
 */
export async function getAllTasks(): Promise<Task[]> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    const result = await db!.select<Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority: string;
      tags: string;
      subtasks: string;
      dueDate: string | null;
      storyPoints: number | null;
      createdAt: string;
      updatedAt: string;
      completedAt: string | null;
      embedding: string | null;
    }>>('SELECT * FROM tasks');
    
    // 将数据库格式转换为 Task 对象
    return result.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as Task['status'],
      priority: row.priority as Task['priority'],
      tags: JSON.parse(row.tags || '[]'),
      subtasks: JSON.parse(row.subtasks || '[]'),
      dueDate: row.dueDate || undefined,
      storyPoints: row.storyPoints || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt || undefined,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
    }));
  } catch (error) {
    console.error('❌ 读取任务失败:', error);
    return [];
  }
}

/**
 * 延迟函数（用于重试）
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 保存所有任务（批量替换，带重试机制）
 */
export async function saveTasks(tasks: Task[], retryCount = 0): Promise<boolean> {
  if (!db) {
    await initDatabase();
  }
  
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 200; // 200ms
  
  // 🛡️ 安全检查：如果任务列表为空，不要清空数据库！
  if (!tasks || tasks.length === 0) {
    console.warn('⚠️ 任务列表为空，取消保存以防止数据丢失');
    return false;
  }
  
  console.log(`💾 准备保存 ${tasks.length} 个任务到数据库...`);
  
  try {
    // 使用事务确保数据一致性
    await db!.execute('BEGIN TRANSACTION');
    
    // 🔒 安全的保存策略：使用 INSERT OR REPLACE 而不是先删除
    // 1. 获取当前数据库中的所有任务 ID
    const existingTasks = await db!.select<Array<{ id: string }>>(
      'SELECT id FROM tasks'
    );
    const existingIds = new Set(existingTasks.map(t => t.id));
    const newIds = new Set(tasks.map(t => t.id));
    
    // 2. 找出需要删除的任务（存在于数据库但不在新列表中）
    const idsToDelete = Array.from(existingIds).filter(id => !newIds.has(id));
    
    // 3. 删除不再存在的任务
    for (const id of idsToDelete) {
      await db!.execute('DELETE FROM tasks WHERE id = ?', [id]);
    }
    console.log(`🗑️ 删除了 ${idsToDelete.length} 个不再存在的任务`);
    
    // 4. 插入或更新每个任务
    for (const task of tasks) {
      await db!.execute(
        `INSERT OR REPLACE INTO tasks (
          id, title, description, status, priority, tags, subtasks,
          dueDate, storyPoints, createdAt, updatedAt, completedAt, embedding
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.title,
          task.description,
          task.status,
          task.priority,
          JSON.stringify(task.tags),
          JSON.stringify(task.subtasks),
          task.dueDate || null,
          task.storyPoints || null,
          task.createdAt,
          task.updatedAt,
          task.completedAt || null,
          task.embedding ? JSON.stringify(task.embedding) : null,
        ]
      );
    }
    
    await db!.execute('COMMIT');
    console.log(`✅ 成功保存 ${tasks.length} 个任务到数据库`);
    return true;
  } catch (error: any) {
    console.error('❌ 保存任务失败:', error);
    
    // 尝试回滚
    try {
      await db!.execute('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ 回滚失败:', rollbackError);
    }
    
    // 检查是否是数据库锁定错误
    const isLockError = error?.message?.includes('database is locked') || 
                       error?.message?.includes('locked') ||
                       error?.code === 5;
    
    // 如果是锁定错误且还有重试次数，则重试
    if (isLockError && retryCount < MAX_RETRIES) {
      console.log(`⏳ 数据库被锁定，${RETRY_DELAY}ms 后重试 (${retryCount + 1}/${MAX_RETRIES})...`);
      await delay(RETRY_DELAY * (retryCount + 1)); // 递增延迟
      return saveTasks(tasks, retryCount + 1);
    }
    
    return false;
  }
}

/**
 * 添加单个任务
 */
export async function addTask(task: Task): Promise<boolean> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    await db!.execute(
      `INSERT INTO tasks (
        id, title, description, status, priority, tags, subtasks,
        dueDate, storyPoints, createdAt, updatedAt, completedAt, embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.status,
        task.priority,
        JSON.stringify(task.tags),
        JSON.stringify(task.subtasks),
        task.dueDate || null,
        task.storyPoints || null,
        task.createdAt,
        task.updatedAt,
        task.completedAt || null,
        task.embedding ? JSON.stringify(task.embedding) : null,
      ]
    );
    return true;
  } catch (error) {
    console.error('❌ 添加任务失败:', error);
    return false;
  }
}

/**
 * 更新单个任务
 */
export async function updateTask(task: Task): Promise<boolean> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    await db!.execute(
      `UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        tags = ?, subtasks = ?, dueDate = ?, storyPoints = ?,
        updatedAt = ?, completedAt = ?, embedding = ?
      WHERE id = ?`,
      [
        task.title,
        task.description,
        task.status,
        task.priority,
        JSON.stringify(task.tags),
        JSON.stringify(task.subtasks),
        task.dueDate || null,
        task.storyPoints || null,
        task.updatedAt,
        task.completedAt || null,
        task.embedding ? JSON.stringify(task.embedding) : null,
        task.id,
      ]
    );
    return true;
  } catch (error) {
    console.error('❌ 更新任务失败:', error);
    return false;
  }
}

/**
 * 删除任务
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    await db!.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    return true;
  } catch (error) {
    console.error('❌ 删除任务失败:', error);
    return false;
  }
}

/**
 * 清空所有数据
 */
export async function clearAllTasks(): Promise<boolean> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    await db!.execute('DELETE FROM tasks');
    return true;
  } catch (error) {
    console.error('❌ 清空任务失败:', error);
    return false;
  }
}

/**
 * 导出数据（用于备份）
 */
export async function exportData(): Promise<string | null> {
  try {
    const tasks = await getAllTasks();
    return JSON.stringify({
      tasks,
      version: '1.0.0',
      lastSyncTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ 导出数据失败:', error);
    return null;
  }
}

/**
 * 导入数据（用于恢复备份）
 */
export async function importData(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.tasks || !Array.isArray(data.tasks)) {
      throw new Error('无效的数据格式');
    }
    return await saveTasks(data.tasks);
  } catch (error) {
    console.error('❌ 导入数据失败:', error);
    return false;
  }
}

// ==================== 报告相关函数 ====================

export interface Report {
  id: string;
  type: 'daily' | 'weekly';
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 保存报告（日报或周报）
 */
export async function saveReport(type: 'daily' | 'weekly', date: string, content: string): Promise<boolean> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    const now = new Date().toISOString();
    const id = `${type}_${date}`;
    
    // 尝试插入或更新
    await db!.execute(
      `INSERT INTO reports (id, type, date, content, createdAt, updatedAt)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(type, date) DO UPDATE SET
       content = $4, updatedAt = $6`,
      [id, type, date, content, now, now]
    );
    
    console.log(`✅ 保存${type === 'daily' ? '日报' : '周报'}成功:`, date);
    return true;
  } catch (error) {
    console.error(`❌ 保存${type === 'daily' ? '日报' : '周报'}失败:`, error);
    return false;
  }
}

/**
 * 获取报告
 */
export async function getReport(type: ReportType, date: string): Promise<string | null> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    const result = await db!.select<Array<{ content: string }>>(
      'SELECT content FROM reports WHERE type = $1 AND date = $2',
      [type, date]
    );
    
    return result.length > 0 ? result[0].content : null;
  } catch (error) {
    console.error(`❌ 读取报告失败 (type: ${type}):`, error);
    return null;
  }
}

/**
 * 获取所有报告（用于迁移和备份）
 */
export async function getAllReports(): Promise<Report[]> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    const result = await db!.select<Report[]>('SELECT * FROM reports ORDER BY date DESC');
    return result;
  } catch (error) {
    console.error('❌ 读取报告列表失败:', error);
    return [];
  }
}

// ==================== 每日统计相关函数 ====================

export interface DailyStats {
  id: string;
  date: string;
  workHours: number;
  deepWorkHours: number;
  tasksCompleted: number;
  focusScore: number;
  timeDistribution: any;
  appUsage: any[];
  focusPeriods: any[];
  rpgStats: any;
  createdAt: string;
  updatedAt: string;
}

/**
 * 保存每日统计数据
 */
export async function saveDailyStats(
  date: string,
  stats: {
    workHours: number;
    deepWorkHours: number;
    tasksCompleted: number;
    focusScore: number;
    timeDistribution: any;
    appUsage: any[];
    focusPeriods: any[];
    rpgStats: any;
  }
): Promise<boolean> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    const now = new Date().toISOString();
    const id = `stats_${date}`;
    
    await db!.execute(
      `INSERT INTO daily_stats (
        id, date, workHours, deepWorkHours, tasksCompleted, focusScore,
        timeDistribution, appUsage, focusPeriods, rpgStats, createdAt, updatedAt
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT(date) DO UPDATE SET
        workHours = $3, deepWorkHours = $4, tasksCompleted = $5, focusScore = $6,
        timeDistribution = $7, appUsage = $8, focusPeriods = $9, rpgStats = $10,
        updatedAt = $12`,
      [
        id,
        date,
        stats.workHours,
        stats.deepWorkHours,
        stats.tasksCompleted,
        stats.focusScore,
        JSON.stringify(stats.timeDistribution),
        JSON.stringify(stats.appUsage),
        JSON.stringify(stats.focusPeriods),
        JSON.stringify(stats.rpgStats),
        now,
        now,
      ]
    );
    
    console.log('✅ 保存每日统计成功:', date);
    return true;
  } catch (error) {
    console.error('❌ 保存每日统计失败:', error);
    return false;
  }
}

/**
 * 获取每日统计数据
 */
export async function getDailyStats(date: string): Promise<DailyStats | null> {
  if (!db) {
    await initDatabase();
  }
  
  try {
    const result = await db!.select<Array<{
      id: string;
      date: string;
      workHours: number;
      deepWorkHours: number;
      tasksCompleted: number;
      focusScore: number;
      timeDistribution: string;
      appUsage: string;
      focusPeriods: string;
      rpgStats: string;
      createdAt: string;
      updatedAt: string;
    }>>('SELECT * FROM daily_stats WHERE date = $1', [date]);
    
    if (result.length === 0) return null;
    
    const row = result[0];
    return {
      ...row,
      timeDistribution: JSON.parse(row.timeDistribution),
      appUsage: JSON.parse(row.appUsage),
      focusPeriods: JSON.parse(row.focusPeriods),
      rpgStats: JSON.parse(row.rpgStats),
    };
  } catch (error) {
    console.error('❌ 读取每日统计失败:', error);
    return null;
  }
}

// ==================== 数据迁移函数 ====================

const REPORT_MIGRATION_FLAG = 'reports_migrated_to_db_v1';

/**
 * 从 localStorage 迁移报告数据到数据库
 */
export async function migrateReportsFromLocalStorage(): Promise<void> {
  // 检查是否已经迁移过
  const migrated = localStorage.getItem(REPORT_MIGRATION_FLAG);
  if (migrated === 'true') {
    console.log('📦 [迁移] 报告数据已迁移，跳过');
    return;
  }
  
  try {
    console.log('📦 [迁移] 开始从 localStorage 迁移报告数据...');
    let migratedCount = 0;
    
    // 遍历 localStorage 查找日报和周报
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // 迁移日报 (dailyReport_YYYY-MM-DD)
      if (key.startsWith('dailyReport_')) {
        const date = key.replace('dailyReport_', '');
        const content = localStorage.getItem(key);
        if (content && content.length > 0) {
          await saveReport('daily', date, content);
          migratedCount++;
          console.log(`  ✅ 迁移日报: ${date}`);
        }
      }
      
      // 迁移周报 (weeklyReport_YYYY-MM-DD)
      if (key.startsWith('weeklyReport_')) {
        const date = key.replace('weeklyReport_', '');
        const content = localStorage.getItem(key);
        if (content && content.length > 0) {
          await saveReport('weekly', date, content);
          migratedCount++;
          console.log(`  ✅ 迁移周报: ${date}`);
        }
      }
    }
    
    // 标记为已迁移
    localStorage.setItem(REPORT_MIGRATION_FLAG, 'true');
    console.log(`✅ [迁移] 成功迁移 ${migratedCount} 个报告`);
  } catch (error) {
    console.error('❌ [迁移] 报告数据迁移失败:', error);
  }
}
