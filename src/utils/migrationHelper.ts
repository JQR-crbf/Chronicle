/**
 * 数据迁移辅助工具
 * 提供迁移状态检查和手动迁移功能
 */

const MIGRATION_FLAG_KEY = 'geminitask_migrated_to_db';
const STORAGE_KEY = 'geminitask_data';

export interface MigrationStatus {
  isMigrated: boolean;
  hasLocalStorageData: boolean;
  localStorageTaskCount: number;
  databaseTaskCount?: number;
  migrationTime?: string;
}

/**
 * 检查迁移状态
 */
export function checkMigrationStatus(): MigrationStatus {
  const isMigrated = localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
  const raw = localStorage.getItem(STORAGE_KEY);
  
  let localStorageTaskCount = 0;
  let hasLocalStorageData = false;
  
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data.tasks && Array.isArray(data.tasks)) {
        localStorageTaskCount = data.tasks.length;
        hasLocalStorageData = true;
      }
    } catch (error) {
      console.error('解析 localStorage 数据失败:', error);
    }
  }
  
  return {
    isMigrated,
    hasLocalStorageData,
    localStorageTaskCount,
  };
}

/**
 * 重置迁移标记（用于重新迁移）
 */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
  console.log('✅ 迁移标记已重置');
}

/**
 * 显示迁移状态（用于调试）
 */
export function showMigrationStatus(): void {
  const status = checkMigrationStatus();
  
  console.log('========== 数据迁移状态 ==========');
  console.log('已迁移到数据库:', status.isMigrated ? '✅ 是' : '❌ 否');
  console.log('localStorage 中有数据:', status.hasLocalStorageData ? '✅ 是' : '❌ 否');
  console.log('localStorage 任务数量:', status.localStorageTaskCount);
  console.log('================================');
  
  if (!status.isMigrated && status.hasLocalStorageData) {
    console.log('💡 提示: 刷新页面将自动迁移数据到数据库');
  }
  
  if (status.isMigrated) {
    console.log('💡 提示: 如需重新迁移，运行 forceMigration()');
  }
}

/**
 * 导出 localStorage 数据（用于备份）
 */
export function exportLocalStorageData(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    console.log('❌ localStorage 中没有数据');
    return null;
  }
  
  console.log('✅ 数据已导出到控制台，请复制保存');
  return raw;
}

/**
 * 清理 localStorage（保留迁移标记）
 */
export function cleanupLocalStorage(): void {
  const migrationFlag = localStorage.getItem(MIGRATION_FLAG_KEY);
  localStorage.removeItem(STORAGE_KEY);
  
  if (migrationFlag) {
    localStorage.setItem(MIGRATION_FLAG_KEY, migrationFlag);
  }
  
  console.log('✅ localStorage 已清理（保留迁移标记）');
}
