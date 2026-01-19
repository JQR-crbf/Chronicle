import React from 'react';
import { Task } from '../../types';
import { PriorityBadge } from '../common/PriorityBadge';
import { TagPill } from '../common/TagPill';
import { GripVerticalIcon, CalendarIcon, CheckIcon } from '../icons';

interface TaskCardProps {
  task: Task;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onClick: () => void;
}

export const TaskCard = ({ task, isDragging, onDragStart, onDragEnd, onDragOver, onDrop, onClick }: TaskCardProps) => {
  const [isDraggingLocal, setIsDraggingLocal] = React.useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    console.log('🎬 TaskCard: dragstart 事件触发, 任务:', task.title);
    setIsDraggingLocal(true);
    onDragStart(e);
  };

  const handleDragEnd = () => {
    console.log('🏁 TaskCard: dragend 事件触发, 任务:', task.title);
    setIsDraggingLocal(false);
    onDragEnd();
  };

  const handleDragOver = (e: React.DragEvent) => {
    console.log('👋 TaskCard: dragover 事件触发！任务:', task.title);
    if (onDragOver) {
      onDragOver(e);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    console.log('📥 TaskCard: drop 事件触发！任务:', task.title);
    if (onDrop) {
      onDrop(e);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // 如果刚刚拖拽过，不触发点击
    if (isDraggingLocal) {
      console.log('⏭️ TaskCard: 跳过 click（刚刚拖拽过）');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    console.log('👆 TaskCard: click 事件触发');
    onClick();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        hover-lift
        group bg-white/90 p-4 rounded-2xl border border-white/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] cursor-grab active:cursor-grabbing 
        hover:border-rose-200 transition-all duration-300 relative overflow-hidden
        ${isDragging ? 'opacity-40 rotate-3 scale-95 grayscale' : ''}
      `}
    >
      <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-rose-100 to-amber-100 rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>

      <div className="flex justify-between items-start mb-2.5 relative z-10">
         <PriorityBadge priority={task.priority} />
        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300">
          <GripVerticalIcon className="w-4 h-4" />
        </div>
      </div>
      
      <h3 className="font-bold text-stone-700 mb-2.5 line-clamp-2 leading-snug relative z-10">{task.title}</h3>
      
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 relative z-10">
          {task.tags.map(tag => (
            <TagPill key={tag} text={tag} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100 relative z-10">
        <div className="flex items-center gap-2">
           {task.dueDate && (
             <div className="flex items-center gap-1 text-[11px] text-rose-400 font-semibold bg-rose-50 px-2 py-1 rounded-md">
                <CalendarIcon className="w-3 h-3" />
                <span>{new Date(task.dueDate).toLocaleDateString('zh-CN', {month: 'numeric', day: 'numeric'})}</span>
             </div>
           )}
           {task.storyPoints && (
              <div className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold bg-amber-50 px-2 py-1 rounded-md">
                <span>{task.storyPoints} 点</span>
              </div>
           )}
        </div>

        {task.subtasks.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-stone-400 font-medium">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-colors duration-300 ${task.subtasks.every(s => s.completed) ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-stone-100 border-stone-200'}`}>
               <CheckIcon className="w-2.5 h-2.5" />
            </div>
            <span>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>
          </div>
        )}
      </div>
    </div>
  );
};

