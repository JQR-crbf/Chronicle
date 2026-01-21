import React, { useState, useMemo, useEffect, useRef } from "react";
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { invoke } from '@tauri-apps/api/core';
import { Task, Status, Priority, Subtask, ViewMode, SortMode, ChatMessage, AISettings } from './types';
import { initialTasks, STATUS_LABELS, PRIORITY_LABELS } from './constants';
import { LayoutGridIcon, ClockIcon, ChartPieIcon, SearchIcon, SparklesIcon, BellIcon, PlusIcon } from './components/icons';
import { TaskDetailModal } from './components/modals/TaskDetailModal';
import { RPGDetailModal } from './components/modals/RPGDetailModal';
import { SuggestionsModal } from './components/modals/SuggestionsModal';
import { AISettingsModal } from './components/modals/AISettingsModal';
import { ChatSidebar } from './components/chat/ChatSidebar';
import { BoardView } from './views/BoardView';
import { TimelineView } from './views/TimelineView';
import { InsightsView } from './views/InsightsView';
import { storage } from './utils/storage';
import { getRecentEvents, checkScreenpipeStatus, getEventsAroundTime } from './utils/screenpipe';
import { autoMigrate, migrateTaskData } from './utils/dataMigration';
import { showMigrationStatus, exportLocalStorageData } from './utils/migrationHelper';
import { loadAISettings, saveAISettings, getModelName } from './utils/aiSettings';
import { createAIClient } from './utils/aiClient';
import { embeddingManager } from './utils/embeddingManager';
import { loadGitHubConfig } from './utils/githubConfig';

const App = () => {
  // 初始化：优先从数据库读取，否则使用默认数据
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRPGModalOpen, setIsRPGModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticSearchResults, setSemanticSearchResults] = useState<string[]>([]); // 存储相似任务的 ID
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  
  const [aiStreaming, setAiStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'model', text: '嗨！我是你的可爱助手 🌸\n\n我可以帮你：\n✅ 管理任务（"帮我创建一个明天截止的高优先级任务"）\n🔍 查询活动记录（"我昨天下午做了什么？"、"今天上午我干了啥？"）\n📊 搜索相关任务\n\n随时问我任何问题吧！' }
  ]);
  const [chatStreaming, setChatStreaming] = useState(false);
  
  // Drafts State
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftSuggestions, setDraftSuggestions] = useState<Array<{ id: number; title: string; time: string }>>([]);

  // Screenpipe 连接状态
  const [screenpipeConnected, setScreenpipeConnected] = useState(false);

  // AI 设置状态
  const [aiSettings, setAISettings] = useState<AISettings>(() => loadAISettings());
  const [showAISettings, setShowAISettings] = useState(false);

  // 创建 AI 客户端（当设置变化时重新创建）
  const ai = useMemo(() => {
    try {
      if (!aiSettings.apiKey) {
        console.warn('⚠️ 未配置 AI API Key');
        return null;
      }
      return createAIClient(aiSettings);
    } catch (error) {
      console.error('❌ 创建 AI 客户端失败:', error);
      return null;
    }
  }, [aiSettings]);

  // 获取当前使用的模型名称
  const modelName = useMemo(() => getModelName(aiSettings), [aiSettings]);

  // --- 初始化：从数据库加载任务 ---
  useEffect(() => {
    const loadTasks = async () => {
      try {
        console.log('🔄 正在从数据库加载任务...');
        const savedTasks = await storage.getTasks();
        if (savedTasks && savedTasks.length > 0) {
          setTasks(savedTasks);
          console.log(`✅ 已加载 ${savedTasks.length} 个任务`);
        } else {
          console.log('ℹ️ 数据库中没有任务，使用默认数据');
          // 保存默认任务到数据库
          await storage.saveTasks(initialTasks);
        }
      } catch (error) {
        console.error('❌ 加载任务失败:', error);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks();
    
    // 暴露调试函数到全局
    (window as any).forceMigration = async () => {
      console.log('🔄 手动触发数据迁移...');
      await (storage as any).forceMigration();
      window.location.reload();
    };
    
    (window as any).showMigrationStatus = showMigrationStatus;
    (window as any).exportBackup = exportLocalStorageData;
    
    console.log('💡 数据库迁移完成！可用命令:');
    console.log('  - showMigrationStatus() - 查看迁移状态');
    console.log('  - forceMigration() - 重新迁移数据');
    console.log('  - exportBackup() - 导出备份');
  }, []); // 只在组件挂载时执行一次

  // --- 自动保存到数据库（防抖 + 并发控制） ---
  const savingRef = useRef(false); // 保存锁：防止并发保存
  
  useEffect(() => {
    // 跳过初始加载时的保存
    if (isLoadingTasks) return;
    
    // 使用防抖，避免频繁保存导致数据库锁定
    const timeoutId = setTimeout(async () => {
      // 如果正在保存，跳过本次保存
      if (savingRef.current) {
        console.log('⏳ 上一次保存还在进行中，跳过本次保存');
        return;
      }
      
      savingRef.current = true; // 加锁
      console.log('💾 准备保存任务到数据库...');
      
      try {
        const success = await storage.saveTasks(tasks);
        if (success) {
          console.log('✅ 任务已自动保存到数据库');
        } else {
          console.error('❌ 保存任务失败');
        }
      } finally {
        savingRef.current = false; // 解锁
      }
    }, 500); // 延迟 500ms，等待连续操作完成
    
    return () => clearTimeout(timeoutId); // 清除之前的定时器
  }, [tasks, isLoadingTasks]);

  // --- 语义搜索 ---
  useEffect(() => {
    // 如果不是语义搜索模式或没有搜索词，清空结果
    if (!isSemanticSearch || !searchQuery.trim()) {
      setSemanticSearchResults([]);
      return;
    }

    const performSemanticSearch = async () => {
      try {
        console.log(`🔍 开始语义搜索: "${searchQuery}"`);
        
        // 生成搜索词的向量
        const queryEmbedding = await embeddingManager.getEmbedding(searchQuery);
        
        // 找到相似的任务（只搜索有向量的任务）
        const tasksWithEmbedding = tasks.filter(t => t.embedding && t.embedding.length > 0);
        const similarTasks = embeddingManager.findSimilar(
          queryEmbedding,
          tasksWithEmbedding,
          50 // 最多返回 50 个结果
        );
        
        // 只保留相似度大于阈值的任务
        const threshold = 0.25;
        const filteredResults = similarTasks
          .filter(t => t.similarity >= threshold)
          .map(t => t.id);
        
        setSemanticSearchResults(filteredResults);
        console.log(`✨ 语义搜索完成，找到 ${filteredResults.length} 个相关任务`);
      } catch (error) {
        console.warn('⚠️ 语义搜索失败:', error);
        setSemanticSearchResults([]);
      }
    };

    // 添加防抖，避免频繁搜索
    const debounceTimer = setTimeout(performSemanticSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, isSemanticSearch, tasks]);

  // --- Screenpipe 连接检测 ---
  useEffect(() => {
    const checkConnection = async () => {
      const status = await checkScreenpipeStatus();
      setScreenpipeConnected(status);
      if (status) {
        console.log('✅ Screenpipe 已连接');
      } else {
        console.log('⚠️ Screenpipe 未连接，使用演示数据');
      }
    };
    
    checkConnection();
    const timer = setInterval(checkConnection, 60000); // 每分钟检查一次
    
    return () => clearInterval(timer);
  }, []);

  // --- AI 任务建议生成 ---
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  const generateAIDraftSuggestions = async () => {
    if (!screenpipeConnected) {
      console.log('⚠️ Screenpipe 未连接，跳过任务建议生成');
      return;
    }

    if (isGeneratingSuggestions) {
      console.log('⏳ 正在生成中，跳过此次请求');
      return;
    }

    try {
      setIsGeneratingSuggestions(true);
      console.log('🔄 开始生成 AI 任务建议...');
      
      // 1. 获取最近 4 小时的 Screenpipe 数据
      const events = await getRecentEvents(4);
      
      console.log(`📊 获取到 ${events.length} 条 Screenpipe 数据`);
      
      if (events.length === 0) {
        console.log('⚠️ 没有足够的数据生成任务建议');
        return;
      }

      // 2. 提取关键内容，过滤娱乐应用
      const entertainmentApps = ['bilibili', 'youtube', 'twitter', 'tiktok', 'netflix', '游戏'];
      const workEvents = events.filter(e => 
        !entertainmentApps.some(app => e.appName.toLowerCase().includes(app))
      );

      console.log(`📝 过滤后剩余 ${workEvents.length} 条工作相关数据`);

      if (workEvents.length === 0) {
        console.log('⚠️ 过滤后没有工作相关数据');
        // 即使没有工作数据，也清空之前的建议
        setDraftSuggestions([]);
        return;
      }

      // 限制上下文长度，避免 API 调用失败
      const contextText = workEvents
        .slice(0, 50) // 只取前 50 条
        .map(e => `[${e.appName}] ${e.windowTitle}: ${e.content.substring(0, 150)}`)
        .join('\n');

      console.log('📡 调用 AI 生成任务建议...');

      // 检查 AI 客户端
      if (!ai) {
        console.error('❌ AI 未配置，请在设置中配置 API Key');
        alert('请先在设置中配置 AI API Key');
        return;
      }

      // 3. 调用 AI 分析
      const response = await ai.generateContent({
        model: modelName,
        contents: `
你是一个智能任务识别助手。
根据用户的屏幕活动日志，识别出潜在的工作任务。

要求：
1. 只提取工作相关的任务
2. 过滤掉娱乐和摸鱼内容
3. 任务标题要简洁明了（不超过30字）
4. 返回 3-5 个最重要的任务建议
5. 时间使用相对时间（如 "2小时前"、"今天上午"、"昨天"）
6. 每个任务的 id 必须是数字

严格按照以下 JSON 格式返回，不要包含其他内容：
[
  {"id": 1, "title": "任务标题", "time": "时间"},
  {"id": 2, "title": "任务标题", "time": "时间"}
]

活动日志：
${contextText}
        `
      });

      // 4. 解析响应
      console.log('📥 收到 AI 响应');
      const textResponse = response.text;
      console.log('原始响应:', textResponse.substring(0, 200));
      
      // 提取 JSON（去除可能的 markdown 代码块标记和其他文本）
      let jsonText = textResponse.trim();
      
      // 去除 markdown 代码块
      jsonText = jsonText.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
      
      // 如果响应中包含其他文本，尝试提取 JSON 数组
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
      
      console.log('提取的 JSON:', jsonText);
      
      const suggestions = JSON.parse(jsonText);

      // 5. 验证和更新状态
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        // 确保每个建议都有必需的字段
        const validSuggestions = suggestions.filter(s => 
          s && typeof s.id !== 'undefined' && s.title && s.time
        );
        
        if (validSuggestions.length > 0) {
          setDraftSuggestions(validSuggestions);
          console.log('✅ AI 任务建议已生成:', validSuggestions.length, '个任务');
          console.log('建议详情:', validSuggestions);
        } else {
          console.log('⚠️ AI 返回的建议格式不正确');
        }
      } else {
        console.log('⚠️ AI 没有返回有效的建议');
      }
      
    } catch (error: any) {
      console.error('❌ 生成任务建议失败:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack
      });
      // 发生错误时，不清空现有建议
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  // 定期生成任务建议
  useEffect(() => {
    if (screenpipeConnected) {
      generateAIDraftSuggestions(); // 立即执行一次
      
      // 每小时执行一次
      const timer = setInterval(generateAIDraftSuggestions, 4 * 60 * 60 * 1000);
      return () => clearInterval(timer);
    }
  }, [screenpipeConnected, ai]);

  // --- CRUD Operations ---

  /**
   * 为任务生成语义向量
   * 将任务的标题、描述、标签组合后生成向量
   */
  const generateTaskEmbedding = async (task: Task): Promise<number[] | undefined> => {
    try {
      // 组合任务的关键信息
      const taskText = [
        task.title,
        task.description,
        ...task.tags,
      ].filter(Boolean).join(' ');

      // 如果没有有效文本，跳过
      if (!taskText.trim()) {
        return undefined;
      }

      // 生成向量
      const embedding = await embeddingManager.getEmbedding(taskText);
      console.log(`✨ 为任务 "${task.title}" 生成了向量 (${embedding.length} 维)`);
      return embedding;
    } catch (error) {
      console.warn(`⚠️ 为任务 "${task.title}" 生成向量失败:`, error);
      return undefined;
    }
  };

  /**
   * 为任务异步生成并更新向量（不阻塞 UI）
   */
  const updateTaskEmbedding = async (task: Task) => {
    const embedding = await generateTaskEmbedding(task);
    if (embedding) {
      // 静默更新任务的向量
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, embedding } : t
      ));
    }
  };

  const addNewTask = (status: Status) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: `t-${Date.now()}`,
      title: "新想法 ✨",
      description: "",
      status,
      priority: "Medium",
      tags: [],
      subtasks: [],
      storyPoints: 1,
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'Done' ? now : undefined
    };
    setTasks([...tasks, newTask]);
    openTaskDetail(newTask);
    
    // 异步生成向量（不阻塞 UI）
    updateTaskEmbedding(newTask);
  };

  const createAiTask = (args: { title: string; description?: string; priority?: string; dueDate?: string }) => {
    const priorityMap: Record<string, Priority> = {
        "Low": "Low", "Medium": "Medium", "High": "High"
    };
    const priority: Priority = priorityMap[args.priority || "Medium"] || "Medium";
    const now = new Date().toISOString();

    const newTask: Task = {
        id: `t-ai-${Date.now()}-${Math.random()}`,
        title: args.title,
        description: args.description || "",
        status: "To Do",
        priority: priority,
        tags: ["AI Generated"],
        subtasks: [],
        storyPoints: 1,
        dueDate: args.dueDate,
        createdAt: now,
        updatedAt: now
    };
    setTasks(prev => [...prev, newTask]);
    
    // 异步生成向量
    updateTaskEmbedding(newTask);
    
    return newTask;
  };

  /**
   * 根据任务标题查找任务（支持模糊匹配）
   * @returns null - 未找到任务 | Task - 找到唯一任务 | Task[] - 找到多个任务
   */
  const findTaskByTitle = (taskTitle: string): { type: 'none' | 'single' | 'multiple', tasks?: Task | Task[] } => {
    const searchTerm = taskTitle.toLowerCase().trim();
    
    // 模糊匹配：任务标题包含搜索词，或搜索词包含任务标题
    const matchedTasks = tasks.filter(t => 
      t.title.toLowerCase().includes(searchTerm) ||
      searchTerm.includes(t.title.toLowerCase())
    );
    
    if (matchedTasks.length === 0) {
      return { type: 'none' };
    } else if (matchedTasks.length === 1) {
      return { type: 'single', tasks: matchedTasks[0] };
    } else {
      return { type: 'multiple', tasks: matchedTasks };
    }
  };

  const updateTask = (updatedTask: Task) => {
    const now = new Date().toISOString();
    const oldTask = tasks.find(t => t.id === updatedTask.id);
    
    console.log('📝 更新任务:', {
      id: updatedTask.id,
      title: updatedTask.title,
      oldStatus: oldTask?.status,
      newStatus: updatedTask.status
    });
    
    // 自动更新时间戳
    const taskWithTimestamps = {
      ...updatedTask,
      updatedAt: now,
      // 如果状态变为 Done，设置完成时间
      completedAt: updatedTask.status === 'Done' && oldTask?.status !== 'Done'
        ? now
        : updatedTask.status !== 'Done' && oldTask?.status === 'Done'
        ? undefined  // 如果从 Done 改为其他状态，清除完成时间
        : updatedTask.completedAt
    };
    
    setTasks(tasks.map(t => t.id === updatedTask.id ? taskWithTimestamps : t));
    setCurrentTask(taskWithTimestamps);
    
    // 检查标题、描述或标签是否有变化，如果有则更新向量
    const contentChanged = oldTask && (
      oldTask.title !== updatedTask.title ||
      oldTask.description !== updatedTask.description ||
      JSON.stringify(oldTask.tags) !== JSON.stringify(updatedTask.tags)
    );
    
    if (contentChanged) {
      updateTaskEmbedding(taskWithTimestamps);
    }
    
    console.log('✅ 任务状态已保存到 React state');
  };

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    if (currentTask?.id === taskId) closeModal();
  };

  /**
   * 查找与指定任务相关的任务
   * 基于向量相似度返回最相关的任务
   */
  const findRelatedTasks = (task: Task, limit: number = 5): Task[] => {
    // 如果当前任务没有向量，返回空
    if (!task.embedding || task.embedding.length === 0) {
      return [];
    }

    // 找到所有有向量的其他任务
    const otherTasks = tasks.filter(t => 
      t.id !== task.id && // 排除自己
      t.embedding && 
      t.embedding.length > 0
    );

    // 如果没有其他任务，返回空
    if (otherTasks.length === 0) {
      return [];
    }

    // 使用 embedding manager 找到最相似的任务
    const similarTasks = embeddingManager.findSimilar(
      task.embedding,
      otherTasks,
      limit
    );

    // 过滤掉相似度太低的任务（阈值 0.4）
    return similarTasks
      .filter(t => t.similarity >= 0.4)
      .map(({ similarity, ...task }) => task);
  };

  const addDraftTask = (title: string, draftId: number) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: `t-draft-${Date.now()}`,
      title: title,
      description: "从 AI 建议中添加",
      status: "To Do",
      priority: "Medium",
      tags: ["AI Suggested"],
      subtasks: [],
      storyPoints: 1,
      createdAt: now,
      updatedAt: now
    };
    setTasks([...tasks, newTask]);
    // 从建议列表中移除这条建议
    setDraftSuggestions(draftSuggestions.filter(d => d.id !== draftId));
  };

  const openTaskDetail = (task: Task) => {
    setCurrentTask(task);
    setTagInput("");
    setIsModalOpen(true);
    setStreamingContent("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentTask(null);
    setStreamingContent("");
    setTagInput("");
  };

  // --- Drag and Drop ---

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    console.log('🎬 开始拖拽任务:', taskId);
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    console.log('✅ draggedTaskId 已设置');
    dragOverLoggedRef.current = false; // 重置日志标志
  };

  const dragOverLoggedRef = useRef(false);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    
    // 只打印第一次，避免频繁输出
    if (!dragOverLoggedRef.current) {
      console.log('✋ DragOver 事件正在触发（允许放置）');
      dragOverLoggedRef.current = true;
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Status) => {
    console.log('📍 Drop 事件触发！目标状态:', targetStatus);
    e.preventDefault();
    
    console.log('当前 draggedTaskId:', draggedTaskId);
    if (!draggedTaskId) {
      console.warn('⚠️ draggedTaskId 为空，无法完成拖拽');
      return;
    }

    const task = tasks.find(t => t.id === draggedTaskId);
    console.log('找到的任务:', task?.title || '未找到');
    
    if (task && task.status !== targetStatus) {
      console.log(`🎯 拖拽任务: "${task.title}" 从 "${task.status}" 到 "${targetStatus}"`);
      updateTask({ ...task, status: targetStatus });
      console.log('✅ 任务状态已更新');
    } else if (task && task.status === targetStatus) {
      console.log(`ℹ️ 任务 "${task.title}" 已经在 "${targetStatus}" 列，无需更新`);
    } else if (!task) {
      console.error('❌ 未找到任务 ID:', draggedTaskId);
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    console.log('🏁 拖拽结束（dragend 事件）');
    // 无论拖拽成功与否，都清除拖拽状态
    setDraggedTaskId(null);
  };

  // --- Tag Handling ---
  
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim() && currentTask) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!currentTask.tags.includes(newTag)) {
        updateTask({ ...currentTask, tags: [...currentTask.tags, newTag] });
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    if (!currentTask) return;
    updateTask({ ...currentTask, tags: currentTask.tags.filter(t => t !== tagToRemove) });
  };

  // --- AI Task Helpers ---

  const handleAIPolish = async () => {
    if (!currentTask || !currentTask.description) return;
    setAiStreaming(true);
    setStreamingContent("");

    try {
      const prompt = `请用更有创意、更清晰、更吸引人的语气重写以下任务描述。可以是稍微活泼一点的风格。
      
      任务标题: ${currentTask.title}
      原描述: ${currentTask.description}`;

      // 检查是否支持流式
      if (ai.generateContentStream) {
        const stream = ai.generateContentStream({
          model: modelName,
          contents: prompt,
        });

        let fullText = "";
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            fullText += text;
            setStreamingContent(prev => prev + text);
          }
        }
        
        updateTask({ ...currentTask, description: fullText });
      } else {
        // 不支持流式，使用普通调用
        const response = await ai.generateContent({
          model: modelName,
          contents: prompt,
        });
        
        setStreamingContent(response.text);
        updateTask({ ...currentTask, description: response.text });
      }
    } catch (error) {
      setStreamingContent("AI 休息中...请稍后再试 😴");
    } finally {
      setAiStreaming(false);
    }
  };

  const handleAIBreakdown = async () => {
    if (!currentTask) return;
    
    if (!ai) {
      alert('请先在设置中配置 AI API Key');
      return;
    }
    
    setAiStreaming(true);

    try {
      const prompt = `你是一个专业的项目管理助手。
      请将任务 "${currentTask.title}" 拆解为 3-5 个具体的、简练的执行步骤。
      
      格式要求：
      1. 必须是纯文本，严禁包含 **粗体** 或 *斜体* 等 Markdown 符号。
      2. 每一行写一个步骤。
      3. 去掉所有序号（如 1. 2.），直接返回步骤内容。
      4. 不要包含任何解释性文字，不要前言，不要总结。
      5. 确保每个步骤都是可执行的动作。`;

      let fullText = "";
      
      if (ai.generateContentStream) {
        const stream = ai.generateContentStream({
          model: modelName,
          contents: prompt,
        });

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            fullText += text;
          }
        }
      } else {
        const response = await ai.generateContent({
          model: modelName,
          contents: prompt,
        });
        fullText = response.text;
      }

      const lines = fullText.split('\n').filter(line => line.trim().length > 0);
      const newSubtasks: Subtask[] = lines.map((line, index) => ({
        id: `st-${Date.now()}-${index}`,
        title: line.replace(/(\*\*|__|\*|_)/g, '').replace(/^[\d\.\-\•\s]+/, '').trim(),
        completed: false
      }));

      updateTask({ ...currentTask, subtasks: [...currentTask.subtasks, ...newSubtasks] });

    } catch (error) {
      console.error(error);
    } finally {
      setAiStreaming(false);
    }
  };

  // --- AI Project Chat ---

  const handleClearChat = () => {
    // 重置聊天记录到初始状态，只保留欢迎消息
    setChatMessages([
      { id: 'welcome', role: 'model', text: '嗨！我是你的可爱助手 🌸\n\n我可以帮你：\n✅ 管理任务（"帮我创建一个明天截止的高优先级任务"）\n🔍 查询活动记录（"我昨天下午做了什么？"、"今天上午我干了啥？"）\n📊 搜索相关任务\n\n随时问我任何问题吧！' }
    ]);
    console.log('🗑️ 聊天记录已清空');
  };

  const handleChatSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || chatStreaming) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatStreaming(true);

    const tempId = (Date.now() + 1).toString();
    setChatMessages(prev => [...prev, { id: tempId, role: 'model', text: '' }]);

    try {
      // 🌟 在用户提问时，自动进行语义搜索相关任务
      let relatedTasksInfo = "";
      try {
        const queryEmbedding = await embeddingManager.getEmbedding(userMsg.text);
        const tasksWithEmbedding = tasks.filter(t => t.embedding && t.embedding.length > 0);
        const similarTasks = embeddingManager.findSimilar(queryEmbedding, tasksWithEmbedding, 5);
        
        if (similarTasks.length > 0 && similarTasks[0].similarity >= 0.3) {
          relatedTasksInfo = `\n\n🔍 Based on semantic search, I found these related tasks:\n${
            similarTasks
              .filter(t => t.similarity >= 0.3)
              .map((t, i) => `${i + 1}. "${t.title}" (${t.status}, ${t.priority} priority)${t.description ? ` - ${t.description.substring(0, 50)}...` : ''}`)
              .join('\n')
          }`;
        }
      } catch (error) {
        console.warn('语义搜索失败，继续正常对话:', error);
      }

      // Define Tools
      const createTaskTool: FunctionDeclaration = {
        name: "createTask",
        description: "Create a new task in the project management system. Use this when the user asks to add, create, or remind them of a task. If the user asks for multiple tasks, call this tool multiple times.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "The short title of the task" },
                description: { type: Type.STRING, description: "Full description of the task" },
                priority: { type: Type.STRING, enum: ["Low", "Medium", "High"], description: "Priority level. Default to Medium if not specified." },
                dueDate: { type: Type.STRING, description: "Due date in YYYY-MM-DD format" }
            },
            required: ["title"]
        }
      };

      const queryTimelineTool: FunctionDeclaration = {
        name: "queryTimeline",
        description: "MUST USE THIS TOOL when user asks about their past activities or what they were doing. Query the user's activity timeline from Screenpipe to get actual activity data (apps used, windows opened, content). DO NOT guess or say you don't know - always call this tool for activity questions. Supports any date/time: '今天下午', '昨天3点', '2025年12月10日', '上午', etc.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                timeDescription: { 
                  type: Type.STRING, 
                  description: "Natural language time/date description in Chinese. Examples: '今天下午6点', '昨天下午', '2025年12月10日上午', '3天前', '上午', '今天下午'" 
                },
                minutesRange: { 
                  type: Type.NUMBER, 
                  description: "Search range in minutes (±). Use 30-60 for specific times ('3点'), 120-240 for broader periods ('下午', '昨天'). Default: 30" 
                }
            },
            required: ["timeDescription"]
        }
      };

      const pushDailyReportTool: FunctionDeclaration = {
        name: "pushDailyReport",
        description: "MUST USE THIS TOOL when user wants to push/upload daily report to GitHub. Use this when user says '推送日报', '上传日报', '提交日报', 'push report', etc. The user will provide the report content in their message.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                content: { 
                  type: Type.STRING, 
                  description: "The complete Markdown content of the daily report that user wants to push. Extract this from user's message." 
                },
                date: { 
                  type: Type.STRING, 
                  description: "Report date in YYYY-MM-DD format. Default to today if not specified." 
                }
            },
            required: ["content"]
        }
      };

      const updateTaskTool: FunctionDeclaration = {
        name: "updateTask",
        description: "Update an existing task's properties. Use when user wants to change task status, description, priority, or due date. Supports partial task name matching.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskTitle: { 
                  type: Type.STRING, 
                  description: "Task name or keywords to find the task. Supports partial matching. Example: '买猫粮', '日报', '学习'" 
                },
                status: { 
                  type: Type.STRING, 
                  enum: ["To Do", "In Progress", "Done"],
                  description: "New status (optional). Map user intent: '完成/做完/已完成/完成啦' → 'Done'; '开始/进行中/开始做' → 'In Progress'; '待办/还没做/改回待办' → 'To Do'" 
                },
                description: { 
                  type: Type.STRING, 
                  description: "New task description (optional)" 
                },
                priority: { 
                  type: Type.STRING, 
                  enum: ["Low", "Medium", "High"],
                  description: "New priority (optional). Map: '低' → 'Low', '中' → 'Medium', '高' → 'High'" 
                },
                dueDate: { 
                  type: Type.STRING, 
                  description: "New due date in YYYY-MM-DD format (optional)" 
                }
            },
            required: ["taskTitle"]
        }
      };

      const today = new Date().toISOString().split('T')[0];
      
      const projectContext = JSON.stringify(tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: STATUS_LABELS[t.status],
        priority: PRIORITY_LABELS[t.priority],
        dueDate: t.dueDate,
        tags: t.tags
      })));

      const systemInstruction = `
      You are a cheerful, cute, and helpful project assistant in a pastel-themed app.
      Current Date: ${today}
      Current Project State: ${projectContext}
      ${relatedTasksInfo}
      
      IMPORTANT - YOUR CAPABILITIES:
      1. Task Management: 
         - Create tasks using the createTask tool
         - Update tasks using the updateTask tool (change status, description, priority, due date)
      2. Timeline Query: You HAVE ACCESS to the user's activity timeline via Screenpipe
      3. Daily Report Push: You can push daily reports to GitHub using the pushDailyReport tool
      
      WHEN USER WANTS TO UPDATE A TASK:
      - YOU MUST call the updateTask tool
      - Examples that REQUIRE updateTask:
        * "把买猫粮标记为完成" → call updateTask("买猫粮", {status: "Done"})
        * "买猫粮完成了" → call updateTask("买猫粮", {status: "Done"})
        * "开始做日报" → call updateTask("日报", {status: "In Progress"})
        * "把学习的描述改为学习React Hooks" → call updateTask("学习", {description: "学习React Hooks"})
        * "把写代码改为高优先级" → call updateTask("写代码", {priority: "High"})
      
      WHEN USER ASKS ABOUT THEIR ACTIVITIES (what they did, what they were doing at a specific time):
      - YOU MUST call the queryTimeline tool to get their actual activity data
      - Examples that REQUIRE queryTimeline:
        * "我今天下午做了什么？" → call queryTimeline("今天下午", 120)
        * "我昨天3点在做什么？" → call queryTimeline("昨天下午3点", 30)
        * "我上午干了啥？" → call queryTimeline("上午", 180)
        * "2025年12月10日我做了什么？" → call queryTimeline("2025年12月10日", 240)
      
      - NEVER say "我无法知道" or "我没有办法知道" when asked about activities
      - ALWAYS use queryTimeline to answer activity-related questions
      - For broad time periods (like "昨天" or "上午"), use minutesRange: 120-240
      - For specific times (like "下午3点"), use minutesRange: 30-60
      
      WHEN USER WANTS TO PUSH DAILY REPORT:
      - YOU MUST call the pushDailyReport tool
      - Examples that REQUIRE pushDailyReport:
        * "帮我推送日报" + [report content] → call pushDailyReport(content, today)
        * "上传今天的日报" + [report content] → call pushDailyReport(content, today)
        * "提交日报到GitHub" + [report content] → call pushDailyReport(content, today)
      
      - The user will paste the report content in their message
      - Extract the complete report content from their message
      - If no date specified, use today's date
      
      Context Memory:
      - Remember the user's previous requests from the conversation history
      - If the user refers to "those tasks" or "the task I just added", look at the project state or history
      - When I provide related tasks from semantic search, mention them naturally if relevant
      
      - Always answer in Chinese. Use emojis occasionally to be friendly and cute.
      `;

      // Construct History for API
      const historyContent = chatMessages.map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }]
      }));

      const currentContent = { role: 'user', parts: [{ text: userMsg.text }] };

      const response = await ai.generateContent({
        model: modelName,
        contents: [...historyContent, currentContent],
        config: {
            tools: [{ functionDeclarations: [createTaskTool, updateTaskTool, queryTimelineTool, pushDailyReportTool] }],
            systemInstruction: systemInstruction
        }
      });

      const calls = (response as any).functionCalls;
      
      console.log('🤖 AI Response:', {
        hasText: !!response.text,
        hasFunctionCalls: !!calls,
        functionCallsCount: calls?.length || 0,
        functionNames: calls?.map((c: any) => c.name) || []
      });

      if (calls && calls.length > 0) {
          console.log('🔧 Function Calls Detected:', calls.map((c: any) => ({ name: c.name, args: c.args })));
          // Handle Multiple Function Calls
          const newTasksCreated: any[] = [];
          const tasksUpdated: any[] = [];
          let timelineResults: string = "";
          let pushReportResult: string = "";
          
          for (const call of calls) {
              if (call.name === "createTask") {
                  const args = call.args as any;
                  const newTask = createAiTask(args);
                  newTasksCreated.push(newTask);
              } else if (call.name === "updateTask") {
                  const args = call.args as any;
                  const { taskTitle, status, description, priority, dueDate } = args;
                  
                  console.log('🔄 [AI更新] 尝试更新任务:', taskTitle);
                  
                  // 查找任务
                  const findResult = findTaskByTitle(taskTitle);
                  
                  if (findResult.type === 'none') {
                    tasksUpdated.push({
                      success: false,
                      message: `没有找到包含"${taskTitle}"的任务。你可以说"列出所有任务"查看当前任务列表。`
                    });
                  } else if (findResult.type === 'multiple') {
                    const matchedTasks = findResult.tasks as Task[];
                    const taskList = matchedTasks.map(t => 
                      `  • ${t.title} (${STATUS_LABELS[t.status]})`
                    ).join('\n');
                    tasksUpdated.push({
                      success: false,
                      message: `找到 ${matchedTasks.length} 个相关任务，请说得更具体一些：\n${taskList}`
                    });
                  } else {
                    // 找到唯一任务
                    const task = findResult.tasks as Task;
                    const oldStatus = task.status;
                    
                    // 构建更新后的任务
                    const updatedFields: Partial<Task> = {};
                    if (status) updatedFields.status = status as Status;
                    if (description !== undefined) updatedFields.description = description;
                    if (priority) updatedFields.priority = priority as Priority;
                    if (dueDate) updatedFields.dueDate = dueDate;
                    
                    // 如果没有任何更新字段，提示用户
                    if (Object.keys(updatedFields).length === 0) {
                      tasksUpdated.push({
                        success: false,
                        message: `请告诉我要更新任务"${task.title}"的哪些内容（状态、描述、优先级或截止日期）`
                      });
                    } else {
                      // 执行更新
                      updateTask({ ...task, ...updatedFields });
                      
                      // 生成更新说明
                      const updates: string[] = [];
                      if (status && status !== oldStatus) {
                        updates.push(`状态: ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[status as Status]}`);
                      }
                      if (description !== undefined) {
                        updates.push(`描述: 已更新`);
                      }
                      if (priority) {
                        updates.push(`优先级: ${PRIORITY_LABELS[priority as Priority]}`);
                      }
                      if (dueDate) {
                        updates.push(`截止日期: ${dueDate}`);
                      }
                      
                      console.log('✅ [AI更新] 更新成功:', task.title, updates);
                      
                      tasksUpdated.push({
                        success: true,
                        task: task,
                        message: `成功更新任务"${task.title}"✅\n${updates.join('\n')}`
                      });
                    }
                  }
              } else if (call.name === "pushDailyReport") {
                  const args = call.args as any;
                  const reportContent = args.content || "";
                  const reportDate = args.date || today;
                  
                  console.log('📤 [AI推送] 开始推送日报...');
                  console.log('📤 [AI推送] 日期:', reportDate);
                  console.log('📤 [AI推送] 内容长度:', reportContent.length);
                  
                  try {
                    // 检查是否有缓存的 GitHub 配置
                    const githubConfig = loadGitHubConfig();
                    
                    if (!githubConfig || !githubConfig.pat || !githubConfig.memberName || !githubConfig.teamDir) {
                      pushReportResult = `\n⚠️ 推送失败：未配置 GitHub 信息\n\n请先在 Insights 视图手动推送一次日报，并勾选"记住 PAT"，下次就可以通过我直接推送了！`;
                      console.warn('⚠️ [AI推送] 未找到 GitHub 配置');
                    } else {
                      // 调用 Tauri 命令推送日报
                      const result = await invoke('push_daily_report', {
                        date: reportDate,
                        content: reportContent,
                        githubPat: githubConfig.pat,
                        memberId: githubConfig.memberName,
                        teamDir: githubConfig.teamDir
                      });
                      
                      console.log('✅ [AI推送] 推送成功:', result);
                      pushReportResult = `\n✅ 日报推送成功！\n\n📁 已推送到 GitHub 仓库\n📅 日期：${reportDate}\n👤 成员：${githubConfig.memberName}\n🌏 团队：${githubConfig.teamDir}`;
                    }
                  } catch (error: any) {
                    console.error('❌ [AI推送] 推送失败:', error);
                    pushReportResult = `\n❌ 推送失败：${error.toString()}\n\n可能的原因：\n  • GitHub PAT 已过期或无效\n  • 网络连接问题\n  • 权限不足`;
                  }
              } else if (call.name === "queryTimeline") {
                  const args = call.args as any;
                  
                  // 解析时间描述
                  const timeDesc = args.timeDescription || "";
                  const minutesRange = args.minutesRange || 30;
                  
                  // 🌟 增强的时间解析器
                  let targetTime = new Date();
                  
                  // 1. 解析相对日期
                  if (timeDesc.includes('昨天')) {
                    targetTime.setDate(targetTime.getDate() - 1);
                  } else if (timeDesc.includes('前天')) {
                    targetTime.setDate(targetTime.getDate() - 2);
                  } else if (timeDesc.includes('大前天')) {
                    targetTime.setDate(targetTime.getDate() - 3);
                  } else if (timeDesc.match(/(\d+)天前/)) {
                    const daysAgo = parseInt(timeDesc.match(/(\d+)天前/)![1]);
                    targetTime.setDate(targetTime.getDate() - daysAgo);
                  } else if (timeDesc.includes('上周') || timeDesc.includes('上星期')) {
                    targetTime.setDate(targetTime.getDate() - 7);
                  }
                  
                  // 2. 解析绝对日期（YYYY年MM月DD日 或 YYYY-MM-DD）
                  const absoluteDateMatch = timeDesc.match(/(\d{4})年?[/-]?(\d{1,2})月?[/-]?(\d{1,2})[日号]?/);
                  if (absoluteDateMatch) {
                    const year = parseInt(absoluteDateMatch[1]);
                    const month = parseInt(absoluteDateMatch[2]) - 1; // JS月份从0开始
                    const day = parseInt(absoluteDateMatch[3]);
                    targetTime = new Date(year, month, day);
                  } else {
                    // 只有月日（MM月DD日）
                    const monthDayMatch = timeDesc.match(/(\d{1,2})月(\d{1,2})[日号]/);
                    if (monthDayMatch) {
                      const month = parseInt(monthDayMatch[1]) - 1;
                      const day = parseInt(monthDayMatch[2]);
                      targetTime.setMonth(month);
                      targetTime.setDate(day);
                    }
                  }
                  
                  // 3. 解析具体时间（点数）
                  const hourMatch = timeDesc.match(/(\d{1,2})[点:](\d{0,2})?/);
                  if (hourMatch) {
                    let hour = parseInt(hourMatch[1]);
                    const minute = hourMatch[2] ? parseInt(hourMatch[2]) : 0;
                    
                    // 处理上午/下午
                    if (timeDesc.includes('下午') || timeDesc.includes('pm')) {
                      if (hour < 12) hour += 12;
                    } else if (timeDesc.includes('上午') || timeDesc.includes('am')) {
                      if (hour === 12) hour = 0;
                    } else if (timeDesc.includes('晚上') || timeDesc.includes('夜里')) {
                      if (hour < 12) hour += 12;
                      if (hour < 18) hour += 12; // 晚上至少是18点以后
                    } else if (timeDesc.includes('早上') || timeDesc.includes('早晨')) {
                      if (hour > 12) hour -= 12;
                      if (hour < 5) hour += 12; // 早上至少是5点以后
                    } else if (timeDesc.includes('中午')) {
                      if (hour < 11 || hour > 13) hour = 12;
                    }
                    
                    targetTime.setHours(hour, minute, 0, 0);
                  } else {
                    // 4. 如果只提到时间段，使用中间时间
                    if (timeDesc.includes('上午')) {
                      targetTime.setHours(10, 0, 0, 0); // 上午10点
                    } else if (timeDesc.includes('下午')) {
                      targetTime.setHours(15, 0, 0, 0); // 下午3点
                    } else if (timeDesc.includes('早上') || timeDesc.includes('早晨')) {
                      targetTime.setHours(8, 0, 0, 0); // 早上8点
                    } else if (timeDesc.includes('中午')) {
                      targetTime.setHours(12, 0, 0, 0); // 中午12点
                    } else if (timeDesc.includes('晚上') || timeDesc.includes('夜里')) {
                      targetTime.setHours(20, 0, 0, 0); // 晚上8点
                    }
                  }
                  
                  console.log(`🔍 查询时间线: "${timeDesc}", 解析为: ${targetTime.toLocaleString('zh-CN')}`);
                  
                  // 获取该时间段的事件
                  try {
                    const events = await getEventsAroundTime(targetTime, minutesRange);
                    
                    if (events.length > 0) {
                      // 按时间排序
                      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                      
                      // 智能摘要：如果事件很多，按应用分组统计
                      if (events.length > 20) {
                        // 统计各应用的使用情况
                        const appStats = events.reduce((acc: any, e) => {
                          if (!acc[e.appName]) {
                            acc[e.appName] = { count: 0, windows: new Set() };
                          }
                          acc[e.appName].count++;
                          acc[e.appName].windows.add(e.windowTitle);
                          return acc;
                        }, {});
                        
                        const appSummary = Object.entries(appStats)
                          .sort((a: any, b: any) => b[1].count - a[1].count)
                          .slice(0, 5)
                          .map(([app, stats]: [string, any]) => 
                            `  • ${app} (${stats.count}次活动, ${stats.windows.size}个窗口)`
                          )
                          .join('\n');
                        
                        // 显示时间范围
                        const firstTime = new Date(events[0].timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                        const lastTime = new Date(events[events.length - 1].timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                        
                        timelineResults = `\n📅 查询到 ${events.length} 条活动记录（${firstTime} - ${lastTime}）:\n\n主要应用:\n${appSummary}`;
                      } else {
                        // 事件较少，详细列出
                        const eventsSummary = events.slice(0, 10).map(e => {
                          const time = new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                          return `[${time}] ${e.appName}: ${e.windowTitle}${e.content ? ` - ${e.content.substring(0, 80)}` : ''}`;
                        }).join('\n');
                        
                        timelineResults = `\n📅 查询到 ${events.length} 条活动记录（${timeDesc}）:\n${eventsSummary}${events.length > 10 ? '\n... 还有更多记录' : ''}`;
                      }
                    } else {
                      timelineResults = `\n⚠️ 没有找到该时间段的活动记录。\n可能原因：\n  • Screenpipe 没有运行\n  • 该时间段没有活动数据\n  • 日期解析错误（当前解析为: ${targetTime.toLocaleString('zh-CN')}）`;
                    }
                  } catch (error) {
                    console.error('查询时间线失败:', error);
                    timelineResults = `\n❌ 查询时间线失败: ${error}\n请确保 Screenpipe 正在运行。`;
                  }
              }
          }
          
          // Generate Follow-up Response
          let followUpPrompt = systemInstruction;
          
          if (newTasksCreated.length > 0) {
            followUpPrompt += `\n\nSYSTEM NOTIFICATION:\nThe following tasks have been created: ${JSON.stringify(newTasksCreated.map(t => t.title))}\nConfirm this to the user enthusiastically!`;
          }
          
          if (timelineResults) {
            followUpPrompt += `\n\nTIMELINE QUERY RESULTS:${timelineResults}\n\nPlease summarize these activities for the user in a friendly way. Mention the most important apps and activities.`;
          }
          
          if (pushReportResult) {
            followUpPrompt += `\n\nDAILY REPORT PUSH RESULT:${pushReportResult}\n\nInform the user about the push result clearly and friendly.`;
          }
          
          if (tasksUpdated.length > 0) {
            const updateResults = tasksUpdated.map(r => 
              r.success ? `✅ ${r.message}` : `❌ ${r.message}`
            ).join('\n');
            followUpPrompt += `\n\nTASK UPDATE RESULTS:\n${updateResults}\n\nInform the user about these task updates in a friendly and clear way.`;
          }
          
          const response2 = await ai.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: userMsg.text }] }],
            config: { systemInstruction: followUpPrompt }
          });
          
          setChatMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, text: response2.text || "✅ 完成！" } : msg
          ));

      } else {
          // Normal chat response (no function calls)
          let responseText = response.text || "抱歉，我没有听懂...";
          
          // 检测是否是活动查询但AI没有调用工具
          const isActivityQuery = /做了?什么|干了?什么|在做什么|在干什么|活动|时间线/.test(userMsg.text);
          if (isActivityQuery && !screenpipeConnected) {
            responseText += "\n\n💡 提示：要查询活动记录，需要先启动 Screenpipe 哦！";
          } else if (isActivityQuery) {
            console.warn('⚠️ AI 没有调用 queryTimeline 工具，但用户似乎在问活动相关的问题');
            responseText += "\n\n🔧 调试信息：如果你想查询活动记录，请确保 Screenpipe 正在运行。";
          }
          
          setChatMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, text: responseText } : msg
          ));
      }

    } catch (error) {
      console.error(error);
      setChatMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, text: "哎呀，我好像断片了 😵‍💫 (API Error)" } : msg
      ));
    } finally {
      setChatStreaming(false);
    }
  };

  // --- Filter and Sort Tasks ---
  const processedTasks = useMemo(() => {
    let result = tasks;

    // 如果有搜索关键词
    if (searchQuery.trim()) {
      if (isSemanticSearch && semanticSearchResults.length > 0) {
        // 🌟 语义搜索模式：使用预计算的结果
        const resultIds = new Set(semanticSearchResults);
        result = tasks.filter(t => resultIds.has(t.id));
        
        // 按相似度顺序排列（semanticSearchResults 已经按相似度排序）
        result.sort((a, b) => {
          return semanticSearchResults.indexOf(a.id) - semanticSearchResults.indexOf(b.id);
        });
      } else if (!isSemanticSearch) {
        // 传统关键词搜索
        result = tasks.filter(t => 
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      // 如果是语义搜索但还没有结果，显示空列表（等待搜索完成）
    }

    // 应用排序（语义搜索时不额外排序，因为已经按相似度排序）
    if (!isSemanticSearch || !searchQuery.trim()) {
      if (sortMode === 'priority') {
        const priorityWeight = { High: 3, Medium: 2, Low: 1 };
        result.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
      } else if (sortMode === 'date') {
        result.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        });
      }
    }
    
    return result;
  }, [tasks, searchQuery, sortMode, isSemanticSearch, semanticSearchResults]);

  return (
    <div className="fixed inset-0 flex flex-col font-sans overflow-hidden bg-gradient-to-br from-rose-50 via-white to-amber-50">
      {/* Header */}
      <header className="glass-panel mx-4 md:mx-6 mt-4 mb-2 px-4 md:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between shrink-0 z-20 rounded-2xl shadow-sm transition-smooth gap-4 sm:gap-0">
        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-amber-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-200 transform rotate-3 hover:rotate-0 transition-transform duration-300 cursor-pointer">
                <LayoutGridIcon className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-amber-500 hidden lg:block tracking-tight">
                GeminiTask
              </h1>
           </div>

           {/* View Switcher Tabs */}
           <div className="flex bg-stone-100/50 p-1 rounded-xl border border-stone-200/50">
               {[
                   { id: 'board', label: '看板', icon: LayoutGridIcon },
                   { id: 'timeline', label: '时间线', icon: ClockIcon },
                   { id: 'insights', label: '洞察', icon: ChartPieIcon },
               ].map((tab) => (
                   <button
                       key={tab.id}
                       onClick={() => setViewMode(tab.id as ViewMode)}
                       className={`
                           flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                           ${viewMode === tab.id ? 'bg-white text-rose-600 shadow-sm' : 'text-stone-500 hover:text-stone-700 hover:bg-white/50'}
                       `}
                   >
                       <tab.icon className="w-3.5 h-3.5" />
                       <span className="hidden md:inline">{tab.label}</span>
                       <span className="md:hidden">{tab.label.substring(0,2)}</span>
                   </button>
               ))}
           </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* AI Settings Button */}
          <button 
              onClick={() => setShowAISettings(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/80 hover:bg-white border border-stone-200 text-stone-600 text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md hover:border-blue-300"
              title="AI 设置"
          >
              <span className="text-blue-500">🤖</span>
              <span className="hidden lg:inline">AI</span>
          </button>

          {/* Drafts Button - Only Show in Board View */}
          {viewMode === 'board' && (
              <button 
                  onClick={() => setShowDrafts(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/80 hover:bg-white border border-stone-200 text-stone-600 text-xs font-bold rounded-xl transition-all shadow-sm group hover:shadow-md hover:border-rose-300 relative"
              >
                  <BellIcon className="w-4 h-4 text-rose-400 group-hover:animate-swing" />
                  <span className="hidden sm:inline">{draftSuggestions.length} 条建议</span>
                  {draftSuggestions.length > 0 && (
                      <span className="w-2 h-2 bg-rose-500 rounded-full absolute top-2 right-2 animate-pulse"></span>
                  )}
              </button>
          )}
        </div>

        <div className="flex items-center gap-3 hidden sm:flex">
          {viewMode === 'board' && (
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 group-focus-within:text-rose-500 transition-colors" />
                  <input 
                      type="text"
                      placeholder={isSemanticSearch ? "语义搜索..." : "搜索..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-40 bg-white border border-stone-200 rounded-xl py-2 pl-9 pr-3 text-xs font-semibold focus:ring-2 focus:ring-rose-100 focus:border-rose-200 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={() => setIsSemanticSearch(!isSemanticSearch)}
                  className={`
                    px-2 py-2 rounded-lg text-xs font-bold transition-all
                    ${isSemanticSearch 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md' 
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }
                  `}
                  title={isSemanticSearch ? "切换到关键词搜索" : "切换到语义搜索（AI 理解语义）"}
                >
                  ✨
                </button>
              </div>
          )}
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm hover-lift
              ${isChatOpen 
                ? 'bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-rose-200 ring-2 ring-rose-100' 
                : 'bg-white text-stone-600 hover:bg-rose-50 hover:text-rose-600 border border-stone-100'}
            `}
          >
            <SparklesIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI 助手</span>
          </button>
        </div>
      </header>

      {/* Main Layout Switcher */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        
        <main className="flex-1 flex flex-col relative overflow-hidden w-full">
            {viewMode === 'board' && (
                <BoardView
                  tasks={processedTasks}
                  draggedTaskId={draggedTaskId}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onAddTask={addNewTask}
                  onTaskClick={openTaskDetail}
                />
            )}
            
            {viewMode === 'timeline' && <TimelineView ai={ai} modelName={modelName} />}
            
            {viewMode === 'insights' && <InsightsView onOpenRPGDetail={() => setIsRPGModalOpen(true)} ai={ai} modelName={modelName} />}
        </main>

        {/* Chat Sidebar */}
        <ChatSidebar
          isOpen={isChatOpen}
          messages={chatMessages}
          input={chatInput}
          isStreaming={chatStreaming}
          onClose={() => setIsChatOpen(false)}
          onInputChange={setChatInput}
          onSubmit={handleChatSubmit}
          onQuickQuestion={(q) => setChatInput(q)}
          onClearChat={handleClearChat}
        />
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isModalOpen}
        task={currentTask}
        tagInput={tagInput}
        aiStreaming={aiStreaming}
        streamingContent={streamingContent}
        relatedTasks={currentTask ? findRelatedTasks(currentTask, 3) : []}
        onClose={closeModal}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
        onTaskClick={openTaskDetail}
        onTagInputChange={setTagInput}
        onAddTag={handleAddTag}
        onRemoveTag={removeTag}
        onAIPolish={handleAIPolish}
        onAIBreakdown={handleAIBreakdown}
      />

      {/* RPG Detail Modal */}
      <RPGDetailModal
        isOpen={isRPGModalOpen}
        onClose={() => setIsRPGModalOpen(false)}
      />

      {/* AI Suggestions Modal */}
      <SuggestionsModal
        isOpen={showDrafts}
        onClose={() => setShowDrafts(false)}
        suggestions={draftSuggestions}
        onAddTask={addDraftTask}
        onRefresh={generateAIDraftSuggestions}
        isRefreshing={isGeneratingSuggestions}
        isConnected={screenpipeConnected}
      />

      {/* AI Settings Modal */}
      <AISettingsModal
        isOpen={showAISettings}
        onClose={() => setShowAISettings(false)}
        settings={aiSettings}
        onSave={(newSettings) => {
          setAISettings(newSettings);
          saveAISettings(newSettings);
        }}
      />
    </div>
  );
};

export default App;

