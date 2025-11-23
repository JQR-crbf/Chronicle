import React, { useState, useMemo, useEffect } from "react";
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { Task, Status, Priority, Subtask, ViewMode, SortMode, ChatMessage } from './types';
import { initialTasks, STATUS_LABELS, PRIORITY_LABELS } from './constants';
import { LayoutGridIcon, ClockIcon, ChartPieIcon, SearchIcon, SparklesIcon, BellIcon, PlusIcon } from './components/icons';
import { TaskDetailModal } from './components/modals/TaskDetailModal';
import { RPGDetailModal } from './components/modals/RPGDetailModal';
import { ChatSidebar } from './components/chat/ChatSidebar';
import { BoardView } from './views/BoardView';
import { TimelineView } from './views/TimelineView';
import { InsightsView } from './views/InsightsView';
import { storage } from './utils/storage';
import { getRecentEvents, checkScreenpipeStatus } from './utils/screenpipe';
import { autoMigrate, migrateTaskData } from './utils/dataMigration';

const App = () => {
  // 初始化：优先从 localStorage 读取，否则使用默认数据
  const [tasks, setTasks] = useState<Task[]>(() => {
    const savedTasks = storage.getTasks();
    return savedTasks || initialTasks;
  });
  
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRPGModalOpen, setIsRPGModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  
  const [aiStreaming, setAiStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'model', text: '嗨！我是你的可爱助手 🌸。我可以帮你管理任务，比如"帮我创建一个明天截止的高优先级任务"。' }
  ]);
  const [chatStreaming, setChatStreaming] = useState(false);
  
  // Drafts State
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftSuggestions, setDraftSuggestions] = useState([
    { id: 1, title: "回复 Slack 关于 API 的讨论", time: "10:15 AM" },
    { id: 2, title: "更新 README 文档", time: "昨天" },
    { id: 3, title: "Review 登录页设计稿", time: "13:30 PM" }
  ]);

  // Screenpipe 连接状态
  const [screenpipeConnected, setScreenpipeConnected] = useState(false);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);

  // --- 数据迁移（首次加载时执行） ---
  useEffect(() => {
    autoMigrate();
    
    // 暴露重新迁移函数到全局（用于调试）
    (window as any).forceRemigrate = () => {
      console.log('🔄 手动触发重新迁移...');
      migrateTaskData(true);
      window.location.reload();
    };
    
    console.log('💡 提示: 如果数据不正确，可以在控制台运行 forceRemigrate() 重新迁移');
  }, []); // 只在组件挂载时执行一次

  // --- 自动保存到 localStorage ---
  useEffect(() => {
    storage.saveTasks(tasks);
    console.log('✅ 任务已自动保存到本地');
  }, [tasks]);

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

      console.log('📡 调用 Gemini API 生成任务建议...');

      // 3. 调用 Gemini 分析
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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
      const timer = setInterval(generateAIDraftSuggestions, 60 * 60 * 1000);
      return () => clearInterval(timer);
    }
  }, [screenpipeConnected, ai]);

  // --- CRUD Operations ---

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
    return newTask;
  };

  const updateTask = (updatedTask: Task) => {
    const now = new Date().toISOString();
    const oldTask = tasks.find(t => t.id === updatedTask.id);
    
    // 自动更新时间戳
    const taskWithTimestamps = {
      ...updatedTask,
      updatedAt: now,
      // 如果状态变为 Done，设置完成时间
      completedAt: updatedTask.status === 'Done' && oldTask?.status !== 'Done'
        ? now
        : updatedTask.completedAt
    };
    
    setTasks(tasks.map(t => t.id === updatedTask.id ? taskWithTimestamps : t));
    setCurrentTask(taskWithTimestamps);
  };

  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    if (currentTask?.id === taskId) closeModal();
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
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Status) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (task && task.status !== targetStatus) {
      updateTask({ ...task, status: targetStatus });
    }
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

      const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let fullText = "";
      for await (const chunk of response) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          setStreamingContent(prev => prev + text);
        }
      }
      
      updateTask({ ...currentTask, description: fullText });
    } catch (error) {
      setStreamingContent("AI 休息中...请稍后再试 😴");
    } finally {
      setAiStreaming(false);
    }
  };

  const handleAIBreakdown = async () => {
    if (!currentTask) return;
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

      const response = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let fullText = "";
      for await (const chunk of response) {
        const text = chunk.text;
        if (text) fullText += text;
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
      
      Context Memory:
      - Remember the user's previous requests from the conversation history.
      - If the user refers to "those tasks" or "the task I just added", look at the project state or history.
      - Always answer in Chinese. Use emojis occasionally.
      `;

      // Construct History for API
      const historyContent = chatMessages.map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: [{ text: msg.text }]
      }));

      const currentContent = { role: 'user', parts: [{ text: userMsg.text }] };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...historyContent, currentContent],
        config: {
            tools: [{ functionDeclarations: [createTaskTool] }],
            systemInstruction: systemInstruction
        }
      });

      const calls = response.functionCalls;

      if (calls && calls.length > 0) {
          // Handle Multiple Function Calls
          const newTasksCreated: any[] = [];
          
          for (const call of calls) {
              if (call.name === "createTask") {
                  const args = call.args as any;
                  const newTask = createAiTask(args);
                  newTasksCreated.push(newTask);
              }
          }
          
          // Generate Follow-up Confirmation
          const followUpPrompt = `
          ${systemInstruction}
          
          SYSTEM NOTIFICATION:
          The following tasks have JUST been successfully created in the system based on the user's request:
          ${JSON.stringify(newTasksCreated.map(t => t.title))}
          
          INSTRUCTION:
          Reply to the user confirming these specific tasks were created. Be enthusiastic!
          `;
          
          const response2 = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: "Please confirm the tasks creation." }] }],
            config: { systemInstruction: followUpPrompt }
          });
          
          setChatMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, text: response2.text || "✅ 任务已创建！" } : msg
          ));

      } else {
          // Normal chat response
          setChatMessages(prev => prev.map(msg => 
            msg.id === tempId ? { ...msg, text: response.text || "抱歉，我没有听懂..." } : msg
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
    let result = tasks.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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
    return result;
  }, [tasks, searchQuery, sortMode]);

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

        {/* Drafts Button - Only Show in Board View */}
        {viewMode === 'board' && draftSuggestions.length > 0 && (
            <div className="relative">
                <button 
                    onClick={() => setShowDrafts(!showDrafts)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/80 hover:bg-white border border-stone-200 text-stone-600 text-xs font-bold rounded-xl transition-all shadow-sm group"
                >
                    <BellIcon className="w-4 h-4 text-rose-400 group-hover:animate-swing" />
                    <span className="hidden sm:inline">{draftSuggestions.length} 条建议</span>
                    <span className="w-2 h-2 bg-rose-500 rounded-full absolute top-2 right-2 animate-pulse"></span>
                </button>
                
                {/* Mock Drafts Popover */}
                {showDrafts && (
                    <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-stone-100 p-4 z-50 animate-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">AI 发现的任务</h4>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    generateAIDraftSuggestions();
                                }}
                                disabled={isGeneratingSuggestions || !screenpipeConnected}
                                className={`
                                    text-xs font-bold px-2 py-1 rounded-lg transition-all
                                    ${isGeneratingSuggestions 
                                        ? 'bg-stone-100 text-stone-400 cursor-not-allowed' 
                                        : screenpipeConnected
                                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                        : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                    }
                                `}
                                title={!screenpipeConnected ? 'Screenpipe 未连接' : '重新生成建议'}
                            >
                                {isGeneratingSuggestions ? '生成中...' : '🔄 重新生成'}
                            </button>
                        </div>
                        
                        {!screenpipeConnected && (
                            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-100 rounded-lg">
                                <p className="text-xs text-yellow-700">
                                    ⚠️ Screenpipe 未连接，无法生成任务建议
                                </p>
                            </div>
                        )}
                        
                        {draftSuggestions.length > 0 ? (
                            <div className="space-y-2">
                                {draftSuggestions.map((d) => (
                                    <div key={d.id} className="p-3 bg-stone-50 hover:bg-rose-50 rounded-xl border border-stone-100 hover:border-rose-100 transition-colors group">
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-stone-700 group-hover:text-rose-700 flex-1 pr-2">{d.title}</p>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    addDraftTask(d.title, d.id);
                                                }}
                                                className="text-stone-300 hover:text-emerald-500 transition-colors flex-shrink-0"
                                                title="添加到待办"
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-stone-400 mt-1">来源: Screenpipe • {d.time}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-sm text-stone-400 mb-2">暂无建议任务 ✨</p>
                                {screenpipeConnected && (
                                    <p className="text-xs text-stone-400">
                                        点击"重新生成"按钮，AI 将分析您最近的活动并提供任务建议
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        <div className="flex items-center gap-3 hidden sm:flex">
          {viewMode === 'board' && (
              <div className="relative group">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 group-focus-within:text-rose-500 transition-colors" />
                <input 
                    type="text"
                    placeholder="搜索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-40 bg-white border border-stone-200 rounded-xl py-2 pl-9 pr-3 text-xs font-semibold focus:ring-2 focus:ring-rose-100 focus:border-rose-200 outline-none transition-all"
                />
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
                  onAddTask={addNewTask}
                  onTaskClick={openTaskDetail}
                />
            )}
            
            {viewMode === 'timeline' && <TimelineView />}
            
            {viewMode === 'insights' && <InsightsView onOpenRPGDetail={() => setIsRPGModalOpen(true)} />}
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
        />
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isModalOpen}
        task={currentTask}
        tagInput={tagInput}
        aiStreaming={aiStreaming}
        streamingContent={streamingContent}
        onClose={closeModal}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
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
    </div>
  );
};

export default App;

