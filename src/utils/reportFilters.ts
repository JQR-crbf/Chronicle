import type { ScreenpipeEvent } from '../types';

export type FilterStrategy = 'smart' | 'dedup' | 'custom' | 'none';

const DEFAULT_WORK_APPS = [
    'Visual Studio Code', 'VS Code', 'Code',
    'Terminal', 'iTerm', 'iTerm2',
    'Google Chrome', 'Chrome', 'Safari', 'Firefox', 'Edge',
    'Slack', 'WeChat', 'DingTalk', '钉钉', 'Lark', '飞书',
    'Zoom', 'Microsoft Teams', 'Skype',
    'Xcode', 'Android Studio', 'IntelliJ IDEA', 'PyCharm', 'WebStorm',
    'Figma', 'Sketch', 'Adobe XD',
    'Notion', 'Obsidian', 'Typora', 'Logseq',
    'Postman', 'Insomnia',
    'GitHub Desktop', 'GitKraken', 'Sourcetree',
    'Docker Desktop', 'TablePlus', 'Sequel Pro',
    'Microsoft Word', 'Excel', 'PowerPoint', 'Pages', 'Numbers', 'Keynote'
];

const ENTERTAINMENT_APPS = [
    'bilibili', 'youtube', 'netflix', 'tiktok', 'douyin',
    'twitter', 'weibo', 'instagram', 'facebook', '抖音', 'B站'
];

/**
 * 方案 1: 智能筛选
 * - 只保留工作相关应用
 * - 过滤娱乐应用
 * - 去除重复记录
 */
export function smartFilter(events: ScreenpipeEvent[], maxRecords: number): ScreenpipeEvent[] {
    console.log(`🧠 [智能筛选] 开始处理 ${events.length} 条数据`);
    
    // 1. 筛选工作相关应用
    const workEvents = events.filter(e => {
        const isWorkApp = DEFAULT_WORK_APPS.some(app => 
            e.appName?.toLowerCase().includes(app.toLowerCase())
        );
        const isEntertainment = ENTERTAINMENT_APPS.some(app =>
            e.appName?.toLowerCase().includes(app) || 
            e.windowTitle?.toLowerCase().includes(app)
        );
        return isWorkApp && !isEntertainment;
    });
    
    console.log(`🧠 [智能筛选] 筛选后: ${workEvents.length} 条工作数据`);
    
    // 2. 去重
    const deduped = deduplicateEvents(workEvents);
    console.log(`🧠 [智能筛选] 去重后: ${deduped.length} 条`);
    
    // 3. 如果还是太多，采样
    if (deduped.length > maxRecords) {
        const step = Math.floor(deduped.length / maxRecords);
        const sampled = deduped.filter((_, index) => index % step === 0).slice(0, maxRecords);
        console.log(`🧠 [智能筛选] 采样后: ${sampled.length} 条`);
        return sampled;
    }
    
    return deduped;
}

/**
 * 方案 2: 内容去重 + 聚合
 * - 保留所有应用
 * - 智能合并相似内容
 * - 减少冗余
 */
export function dedupFilter(events: ScreenpipeEvent[], maxRecords: number): ScreenpipeEvent[] {
    console.log(`🔄 [去重聚合] 开始处理 ${events.length} 条数据`);
    
    // 1. 按应用分组
    const byApp = new Map<string, ScreenpipeEvent[]>();
    events.forEach(e => {
        const key = e.appName || 'Unknown';
        if (!byApp.has(key)) {
            byApp.set(key, []);
        }
        byApp.get(key)!.push(e);
    });
    
    console.log(`🔄 [去重聚合] 分组: ${byApp.size} 个应用`);
    
    // 2. 每个应用内去重
    const deduped: ScreenpipeEvent[] = [];
    byApp.forEach((appEvents, appName) => {
        const dedupedApp = deduplicateEvents(appEvents);
        deduped.push(...dedupedApp);
    });
    
    console.log(`🔄 [去重聚合] 去重后: ${deduped.length} 条`);
    
    // 3. 按时间排序
    deduped.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // 4. 如果还是太多，均匀采样
    if (deduped.length > maxRecords) {
        const step = Math.floor(deduped.length / maxRecords);
        const sampled = deduped.filter((_, index) => index % step === 0).slice(0, maxRecords);
        console.log(`🔄 [去重聚合] 采样后: ${sampled.length} 条`);
        return sampled;
    }
    
    return deduped;
}

/**
 * 方案 3: 自定义应用筛选
 * - 用户指定关注的应用
 * - 灵活性最高
 */
export function customFilter(
    events: ScreenpipeEvent[], 
    customApps: string[], 
    maxRecords: number
): ScreenpipeEvent[] {
    console.log(`🎯 [自定义筛选] 开始处理 ${events.length} 条数据`);
    console.log(`🎯 [自定义筛选] 关注应用: ${customApps.length} 个`);
    
    if (customApps.length === 0) {
        console.warn(`⚠️ [自定义筛选] 未配置应用列表，返回空数组`);
        return [];
    }
    
    // 1. 筛选自定义应用
    const filtered = events.filter(e => 
        customApps.some(app => 
            e.appName?.toLowerCase().includes(app.toLowerCase())
        )
    );
    
    console.log(`🎯 [自定义筛选] 筛选后: ${filtered.length} 条`);
    
    // 2. 去重
    const deduped = deduplicateEvents(filtered);
    console.log(`🎯 [自定义筛选] 去重后: ${deduped.length} 条`);
    
    // 3. 如果还是太多，采样
    if (deduped.length > maxRecords) {
        const step = Math.floor(deduped.length / maxRecords);
        const sampled = deduped.filter((_, index) => index % step === 0).slice(0, maxRecords);
        console.log(`🎯 [自定义筛选] 采样后: ${sampled.length} 条`);
        return sampled;
    }
    
    return deduped;
}

/**
 * 方案 4: 不筛选（均匀采样）
 * - 保留所有应用
 * - 按时间均匀采样
 */
export function noFilter(events: ScreenpipeEvent[], maxRecords: number): ScreenpipeEvent[] {
    console.log(`📋 [不筛选] 开始处理 ${events.length} 条数据`);
    
    if (events.length <= maxRecords) {
        console.log(`📋 [不筛选] 数据量在限制内，不需要采样`);
        return events;
    }
    
    const step = Math.floor(events.length / maxRecords);
    const sampled = events.filter((_, index) => index % step === 0).slice(0, maxRecords);
    console.log(`📋 [不筛选] 采样后: ${sampled.length} 条`);
    
    return sampled;
}

/**
 * 去重辅助函数
 * 合并 1 分钟内相同应用和窗口的记录
 */
function deduplicateEvents(events: ScreenpipeEvent[]): ScreenpipeEvent[] {
    const deduped: ScreenpipeEvent[] = [];
    
    for (let i = 0; i < events.length; i++) {
        const current = events[i];
        const prev = deduped[deduped.length - 1];
        
        // 如果与上一条是同一个应用和窗口，且时间间隔 < 1 分钟，就跳过
        if (prev && 
            prev.appName === current.appName && 
            prev.windowTitle === current.windowTitle &&
            Math.abs(new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime()) < 60000) {
            continue;
        }
        
        deduped.push(current);
    }
    
    return deduped;
}

/**
 * 主筛选函数 - 根据策略选择不同的筛选方法
 */
export function filterEvents(
    events: ScreenpipeEvent[],
    strategy: FilterStrategy,
    customApps: string[],
    maxRecords: number
): ScreenpipeEvent[] {
    switch (strategy) {
        case 'smart':
            return smartFilter(events, maxRecords);
        case 'dedup':
            return dedupFilter(events, maxRecords);
        case 'custom':
            return customFilter(events, customApps, maxRecords);
        case 'none':
            return noFilter(events, maxRecords);
        default:
            console.warn(`⚠️ 未知策略: ${strategy}，使用智能筛选`);
            return smartFilter(events, maxRecords);
    }
}

