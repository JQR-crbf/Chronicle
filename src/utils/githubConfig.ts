/**
 * GitHub 配置管理
 * 用于缓存 GitHub PAT、成员名称和团队目录
 */

export interface GitHubConfig {
  pat: string;
  memberName: string;
  teamDir: string;
}

const GITHUB_CONFIG_KEY = 'chronicle_github_config';

/**
 * 保存 GitHub 配置到 localStorage
 */
export function saveGitHubConfig(config: GitHubConfig): void {
  try {
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(config));
    console.log('✅ GitHub 配置已保存');
  } catch (error) {
    console.error('❌ 保存 GitHub 配置失败:', error);
  }
}

/**
 * 从 localStorage 读取 GitHub 配置
 */
export function loadGitHubConfig(): GitHubConfig | null {
  try {
    const saved = localStorage.getItem(GITHUB_CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      console.log('✅ 已加载 GitHub 配置');
      return config;
    }
  } catch (error) {
    console.error('❌ 加载 GitHub 配置失败:', error);
  }
  return null;
}

/**
 * 清除 GitHub 配置
 */
export function clearGitHubConfig(): void {
  try {
    localStorage.removeItem(GITHUB_CONFIG_KEY);
    console.log('✅ GitHub 配置已清除');
  } catch (error) {
    console.error('❌ 清除 GitHub 配置失败:', error);
  }
}

/**
 * 检查是否已配置 GitHub
 */
export function hasGitHubConfig(): boolean {
  const config = loadGitHubConfig();
  return !!(config && config.pat && config.memberName && config.teamDir);
}
