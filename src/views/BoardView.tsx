import React from 'react';
import { Status, Task } from '../types';
import { Column } from '../components/board/Column';

interface BoardViewProps {
  tasks: Task[];
  draggedTaskId: string | null;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetStatus: Status) => void;
  onAddTask: (status: Status) => void;
  onTaskClick: (task: Task) => void;
}

export const BoardView = ({
  tasks,
  draggedTaskId,
  onDragStart,
  onDragOver,
  onDrop,
  onAddTask,
  onTaskClick
}: BoardViewProps) => {
  const statuses: Status[] = ["To Do", "In Progress", "Done"];

  return (
    <div className="flex-1 w-full overflow-x-hidden overflow-y-auto md:overflow-x-auto md:overflow-y-hidden p-4 md:p-6 pt-2 scroll-smooth">
        {/* 
            Mobile: grid-cols-1, h-auto (stacks vertically, outer container scrolls).
            Desktop: grid-cols-3, h-full (side-by-side, inner columns scroll).
        */}
        <div className="h-auto md:h-full w-full md:min-w-[1024px] grid grid-cols-1 md:grid-cols-3 gap-6 pb-24 md:pb-0">
            {statuses.map(status => (
              <Column
                key={status}
                status={status}
                tasks={tasks.filter(t => t.status === status)}
                draggedTaskId={draggedTaskId}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, status)}
                onAddTask={() => onAddTask(status)}
                onTaskClick={onTaskClick}
                onDragStart={onDragStart}
              />
            ))}
        </div>
    </div>
  );
};

