import React from 'react';
import { Modal } from '../common/Modal';
import { TagPill } from '../common/TagPill';
import { XIcon, TrashIcon, TagIcon, SparklesIcon, ListTodoIcon, CheckIcon, PlusIcon } from '../icons';
import { Task, Status, Priority, Subtask } from '../../types';

interface TaskDetailModalProps {
  isOpen: boolean;
  task: Task | null;
  tagInput: string;
  aiStreaming: boolean;
  streamingContent: string;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onTagInputChange: (value: string) => void;
  onAddTag: (e: React.KeyboardEvent) => void;
  onRemoveTag: (tag: string) => void;
  onAIPolish: () => void;
  onAIBreakdown: () => void;
}

export const TaskDetailModal = ({
  isOpen,
  task,
  tagInput,
  aiStreaming,
  streamingContent,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onAIPolish,
  onAIBreakdown
}: TaskDetailModalProps) => {
  if (!task) return null;

  const updateTaskField = <K extends keyof Task>(field: K, value: Task[K]) => {
    onUpdateTask({ ...task, [field]: value });
  };

  const toggleSubtask = (subtaskId: string) => {
    const newSubtasks = task.subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    updateTaskField('subtasks', newSubtasks);
  };

  const updateSubtaskTitle = (subtaskId: string, title: string) => {
    const newSubtasks = task.subtasks.map(s => 
      s.id === subtaskId ? { ...s, title } : s
    );
    updateTaskField('subtasks', newSubtasks);
  };

  const removeSubtask = (subtaskId: string) => {
    const newSubtasks = task.subtasks.filter(s => s.id !== subtaskId);
    updateTaskField('subtasks', newSubtasks);
  };

  const addSubtask = () => {
    const newSubtask: Subtask = { id: `st-${Date.now()}`, title: "", completed: false };
    updateTaskField('subtasks', [...task.subtasks, newSubtask]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col max-h-full min-h-0">
        {/* Modal Header */}
        <div className="px-8 py-5 border-b border-stone-100 flex items-center justify-between bg-gradient-to-r from-white to-rose-50/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
                <select 
                value={task.status}
                onChange={(e) => updateTaskField('status', e.target.value as Status)}
                className="appearance-none text-sm font-bold bg-white border border-stone-200 rounded-xl pl-4 pr-8 py-2 text-stone-700 focus:outline-none focus:ring-2 focus:ring-rose-200 shadow-sm cursor-pointer hover:border-rose-300 transition-colors"
                >
                <option value="To Do">待办</option>
                <option value="In Progress">进行中</option>
                <option value="Done">已完成</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onDeleteTask(task.id)} className="text-stone-400 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-50 transition-all" title="删除">
               <TrashIcon className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-100 transition-all">
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-6 bg-white/50 custom-scrollbar modal-body">
          
          {/* Title Input */}
          <div>
            <input 
              type="text" 
              value={task.title}
              onChange={(e) => updateTaskField('title', e.target.value)}
              placeholder="任务标题"
              className="w-full text-3xl font-black text-stone-800 placeholder:text-stone-300 border-none focus:outline-none focus:ring-0 bg-transparent px-0"
            />
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
             <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block px-1">优先级</label>
                <select 
                  value={task.priority}
                  onChange={(e) => updateTaskField('priority', e.target.value as Priority)}
                  className="w-full text-sm font-semibold bg-transparent border-none p-1 text-stone-700 focus:ring-0 cursor-pointer"
                >
                  <option value="Low">低</option>
                  <option value="Medium">中</option>
                  <option value="High">高</option>
                </select>
             </div>
             <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block px-1">截止日期</label>
                <input 
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(e) => updateTaskField('dueDate', e.target.value)}
                  className="w-full text-sm font-semibold bg-transparent border-none p-1 text-stone-700 focus:ring-0" 
                />
             </div>
             <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block px-1">故事点</label>
                <input 
                  type="number"
                  min="0"
                  value={task.storyPoints || 0}
                  onChange={(e) => updateTaskField('storyPoints', parseInt(e.target.value) || 0)}
                  className="w-full text-sm font-semibold bg-transparent border-none p-1 text-stone-700 focus:ring-0" 
                />
             </div>
          </div>

          {/* Tags Section */}
          <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
             <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 block px-1 flex items-center gap-1">
                <TagIcon className="w-3 h-3" /> 标签
             </label>
             <div className="flex flex-wrap gap-2">
                {task.tags.map(tag => (
                    <TagPill key={tag} text={tag} onRemove={() => onRemoveTag(tag)} />
                ))}
                <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => onTagInputChange(e.target.value)}
                    onKeyDown={onAddTag}
                    placeholder="+ 添加标签..."
                    className="bg-transparent text-xs font-medium placeholder:text-stone-400 focus:outline-none min-w-[80px] py-1 px-1 text-stone-600"
                />
             </div>
          </div>

          {/* Description Section */}
          <div className="group relative bg-white p-5 rounded-3xl border border-stone-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-300"></span>
                任务描述
              </label>
              <button 
                onClick={onAIPolish}
                disabled={aiStreaming || !task.description}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                {aiStreaming ? "润色中..." : "✨ AI 润色"}
              </button>
            </div>
            <div className="relative">
              <textarea 
                value={aiStreaming ? streamingContent : task.description}
                onChange={(e) => updateTaskField('description', e.target.value)}
                placeholder="添加更详细的描述..."
                className={`w-full h-32 p-0 bg-transparent border-none text-stone-600 text-base leading-relaxed focus:outline-none focus:ring-0 resize-none ${aiStreaming ? 'animate-pulse text-rose-500' : ''}`}
              />
            </div>
          </div>

          {/* Subtasks Section */}
          <div className="bg-white p-5 rounded-3xl border border-stone-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                子任务
              </label>
              <button 
                onClick={onAIBreakdown}
                disabled={aiStreaming}
                className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                <ListTodoIcon className="w-3.5 h-3.5" />
                📋 智能拆解
              </button>
            </div>
            
            <div className="space-y-2">
              {task.subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center gap-3 p-3 group hover:bg-stone-50 rounded-xl transition-colors border border-transparent hover:border-stone-100">
                  <div 
                    onClick={() => toggleSubtask(subtask.id)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${subtask.completed ? 'bg-emerald-400 border-emerald-400' : 'border-stone-300 bg-white'}`}
                  >
                    {subtask.completed && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                  </div>
                  
                  <input
                    type="text"
                    value={subtask.title}
                    onChange={(e) => updateSubtaskTitle(subtask.id, e.target.value)}
                    className={`flex-1 bg-transparent border-none text-sm font-medium focus:ring-0 p-0 ${subtask.completed ? 'text-stone-400 line-through' : 'text-stone-700'}`}
                  />
                  <button 
                    onClick={() => removeSubtask(subtask.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-rose-500 transition-all"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <button 
                onClick={addSubtask}
                className="flex items-center gap-2 text-sm text-stone-400 hover:text-rose-500 font-bold mt-3 px-3 py-2 rounded-xl hover:bg-rose-50 transition-all w-full border border-dashed border-stone-200 hover:border-rose-200"
              >
                <PlusIcon className="w-4 h-4" />
                添加子任务
              </button>
            </div>
          </div>

        </div>
      </div>
    </Modal>
  );
};

