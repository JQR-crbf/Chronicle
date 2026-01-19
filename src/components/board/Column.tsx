import React, { useState, useMemo } from 'react';
import { Status, Task } from '../../types';
import { STATUS_LABELS } from '../../constants';
import { PlusIcon } from '../icons';
import { TaskCard } from './TaskCard';

type TimeFilter = 'all' | 'today' | 'week' | 'month';

interface ColumnProps {
  status: Status;
  tasks: Task[];
  draggedTaskId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onAddTask: () => void;
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

// 时间筛选函数
const filterTasksByTime = (tasks: Task[], filter: TimeFilter): Task[] => {
  if (filter === 'all') return tasks;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return tasks.filter(task => {
    if (!task.completedAt) return false;
    
    const completedDate = new Date(task.completedAt);
    const completedDay = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
    
    switch (filter) {
      case 'today':
        return completedDay.getTime() === today.getTime();
      
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        return completedDay >= weekAgo;
      }
      
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        return completedDay >= monthAgo;
      }
      
      default:
        return true;
    }
  });
};

export const Column = ({
  status,
  tasks,
  draggedTaskId,
  onDragOver,
  onDrop,
  onDragEnd,
  onAddTask,
  onTaskClick,
  onDragStart
}: ColumnProps) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  
  const borderColor = status === 'To Do' ? 'border-rose-200' : status === 'In Progress' ? 'border-amber-200' : 'border-emerald-200';
  const headerColor = status === 'To Do' ? 'text-rose-600' : status === 'In Progress' ? 'text-amber-600' : 'text-emerald-600';
  const bgTint = status === 'To Do' ? 'bg-rose-50/50' : status === 'In Progress' ? 'bg-amber-50/50' : 'bg-emerald-50/50';
  
  // 应用时间筛选（仅对已完成列）
  const filteredTasks = useMemo(() => {
    if (status === 'Done') {
      return filterTasksByTime(tasks, timeFilter);
    }
    return tasks;
  }, [tasks, timeFilter, status]);

  const timeFilterOptions: { value: TimeFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'today', label: '今天' },
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' }
  ];

  const handleDragOver = (e: React.DragEvent) => {
    console.log(`📍 Column (${status}): dragover 事件触发！`);
    e.preventDefault(); // ← 确保调用 preventDefault！
    onDragOver(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    console.log(`📦 Column (${status}): drop 事件触发`);
    onDrop(e);
  };

  return (
    <div 
      className={`
          flex flex-col 
          md:h-full h-auto min-h-[200px] 
          rounded-3xl p-4 glass transition-colors border-2 ${borderColor} ${bgTint} flex-shrink-0
      `}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-2">
          <h2 className={`font-bold ${headerColor} text-sm uppercase tracking-wide`}>{STATUS_LABELS[status]}</h2>
          <span className="bg-white/80 text-stone-500 text-xs px-2.5 py-0.5 rounded-full font-bold shadow-sm border border-white">
            {filteredTasks.length}
          </span>
        </div>
        <button 
          onClick={onAddTask}
          className="text-stone-400 hover:text-stone-600 hover:bg-white/60 p-1.5 rounded-full transition-all active:scale-95"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* 时间筛选器 - 仅在已完成列显示 */}
      {status === 'Done' && (
        <div className="mb-4 px-1">
          <div className="flex gap-1.5 flex-wrap">
            {timeFilterOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setTimeFilter(option.value)}
                className={`
                  text-xs px-3 py-1.5 rounded-lg font-medium transition-all
                  ${timeFilter === option.value 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : 'bg-white/60 text-stone-600 hover:bg-white/80 hover:shadow-sm'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Task List: Mobile = auto height, visible overflow. Desktop = flex-1, scrollable. */}
      <div 
        className="md:flex-1 md:overflow-y-auto overflow-visible space-y-3.5 custom-scrollbar pb-4 pr-1 h-auto min-h-[120px]"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {filteredTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            isDragging={draggedTaskId === task.id}
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => onTaskClick(task)}
          />
        ))}
        {filteredTasks.length === 0 && status === 'Done' && timeFilter !== 'all' && (
          <div className="h-32 border-2 border-dashed border-stone-200/60 rounded-2xl flex flex-col items-center justify-center text-stone-400/80 text-sm gap-2 animate-in fade-in duration-500">
            <span>此时间段内无已完成任务</span>
          </div>
        )}
        {filteredTasks.length === 0 && (status !== 'Done' || timeFilter === 'all') && (
          <div className="h-32 border-2 border-dashed border-stone-200/60 rounded-2xl flex flex-col items-center justify-center text-stone-400/80 text-sm gap-2 animate-in fade-in duration-500">
            <div className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center shadow-sm">
               <PlusIcon className="w-5 h-5 text-stone-300" />
            </div>
            <span>添加新卡片</span>
          </div>
        )}
      </div>
    </div>
  );
};

