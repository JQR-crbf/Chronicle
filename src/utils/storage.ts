import { Task } from '../types';

/**
 * 存储抽象层
 * 现阶段使用 localStorage，未来打包桌面应用时可轻松切换到文件系统
 */

const STORAGE_KEY = 'geminitask_data';

export interface StorageData {
  tasks: Task[];
  version: string; // 用于未来数据迁移
  lastSyncTime?: string;
}

export const storage = {
  /**
   * 获取所有任务
   */
  getTasks: (): Task[] | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      
      const data: StorageData = JSON.parse(raw);
      return data.tasks;
    } catch (error) {
      console.error('❌ 读取任务失败:', error);
      return null;
    }
  },

  /**
   * 保存所有任务
   */
  saveTasks: (tasks: Task[]): boolean => {
    try {
      const data: StorageData = {
        tasks,
        version: '1.0.0',
        lastSyncTime: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('❌ 保存任务失败:', error);
      return false;
    }
  },

  /**
   * 清空所有数据（用于重置）
   */
  clear: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * 导出数据（用于备份）
   */
  exportData: (): string | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw;
    } catch (error) {
      console.error('❌ 导出数据失败:', error);
      return null;
    }
  },

  /**
   * 导入数据（用于恢复备份）
   */
  importData: (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      localStorage.setItem(STORAGE_KEY, jsonString);
      return true;
    } catch (error) {
      console.error('❌ 导入数据失败:', error);
      return false;
    }
  }
};

// 未来打包桌面应用时，只需要替换这个文件的实现
// 例如 Tauri:
// import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';
// import { appDataDir } from '@tauri-apps/api/path';
//
// 例如 Electron:
// import Store from 'electron-store';
// const store = new Store();

