import { Task } from '../types';
import {
  initDatabase,
  getAllTasks,
  saveTasks as dbSaveTasks,
  addTask,
  updateTask,
  deleteTask,
  clearAllTasks,
  exportData as dbExportData,
  importData as dbImportData,
} from './database';

/**
 * 🔒 纯数据库存储层 - 只使用 SQLite 数据库
 * 
 * 重要说明：
 * - 所有数据只存储在 SQLite 数据库中
 * - 不再使用 localStorage 作为数据源
 * - 不再有降级机制或自动迁移
 * - 确保数据的唯一性和可靠性
 */

// 数据库初始化状态
let dbInitialized = false;

/**
 * 确保数据库已初始化
 */
async function ensureDbInitialized(): Promise<void> {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
    console.log('✅ 数据库已初始化');
  }
}

export const storage = {
  /**
   * 获取所有任务（仅从数据库读取）
   */
  getTasks: async (): Promise<Task[] | null> => {
    try {
      await ensureDbInitialized();
      const tasks = await getAllTasks();
      console.log(`📖 从数据库读取到 ${tasks.length} 个任务`);
      return tasks.length > 0 ? tasks : null;
    } catch (error) {
      console.error('❌ 读取任务失败:', error);
      throw error; // 抛出错误，不降级
    }
  },

  /**
   * 保存所有任务（仅保存到数据库）
   */
  saveTasks: async (tasks: Task[]): Promise<boolean> => {
    try {
      await ensureDbInitialized();
      
      // 🛡️ 数据验证：不允许保存空列表（防止误删除所有数据）
      if (!tasks || tasks.length === 0) {
        console.warn('⚠️ 尝试保存空任务列表，已拒绝以保护数据');
        return false;
      }
      
      console.log(`💾 正在保存 ${tasks.length} 个任务到数据库...`);
      const success = await dbSaveTasks(tasks);
      
      if (success) {
        console.log(`✅ 成功保存 ${tasks.length} 个任务到数据库`);
      } else {
        console.error('❌ 保存失败');
      }
      
      return success;
    } catch (error) {
      console.error('❌ 保存任务失败:', error);
      throw error; // 抛出错误，让调用方处理
    }
  },

  /**
   * 添加单个任务
   */
  addTask: async (task: Task): Promise<boolean> => {
    try {
      await ensureDbInitialized();
      console.log(`➕ 添加任务: ${task.title}`);
      return await addTask(task);
    } catch (error) {
      console.error('❌ 添加任务失败:', error);
      throw error;
    }
  },

  /**
   * 更新单个任务
   */
  updateTask: async (task: Task): Promise<boolean> => {
    try {
      await ensureDbInitialized();
      console.log(`📝 更新任务: ${task.title}`);
      return await updateTask(task);
    } catch (error) {
      console.error('❌ 更新任务失败:', error);
      throw error;
    }
  },

  /**
   * 删除任务
   */
  deleteTask: async (taskId: string): Promise<boolean> => {
    try {
      await ensureDbInitialized();
      console.log(`🗑️ 删除任务: ${taskId}`);
      return await deleteTask(taskId);
    } catch (error) {
      console.error('❌ 删除任务失败:', error);
      throw error;
    }
  },

  /**
   * ⚠️ 清空所有数据（危险操作，需要确认）
   */
  clear: async (): Promise<void> => {
    try {
      await ensureDbInitialized();
      console.warn('⚠️ 正在清空所有数据...');
      await clearAllTasks();
      console.log('✅ 数据已清空');
    } catch (error) {
      console.error('❌ 清空数据失败:', error);
      throw error;
    }
  },

  /**
   * 导出数据（用于备份）
   */
  exportData: async (): Promise<string | null> => {
    try {
      await ensureDbInitialized();
      console.log('📦 导出数据...');
      const data = await dbExportData();
      if (data) {
        console.log('✅ 数据导出成功');
      }
      return data;
    } catch (error) {
      console.error('❌ 导出数据失败:', error);
      throw error;
    }
  },

  /**
   * 导入数据（用于恢复备份）
   */
  importData: async (jsonString: string): Promise<boolean> => {
    try {
      await ensureDbInitialized();
      
      // 验证数据格式
      const data = JSON.parse(jsonString);
      if (!data.tasks || !Array.isArray(data.tasks)) {
        throw new Error('无效的数据格式');
      }
      
      console.log(`📥 导入 ${data.tasks.length} 个任务...`);
      const success = await dbImportData(jsonString);
      
      if (success) {
        console.log('✅ 数据导入成功');
      }
      
      return success;
    } catch (error) {
      console.error('❌ 导入数据失败:', error);
      throw error;
    }
  },
};
