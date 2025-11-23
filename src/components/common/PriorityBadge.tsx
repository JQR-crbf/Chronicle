import React from 'react';
import { Priority } from '../../types';
import { PRIORITY_LABELS } from '../../constants';

interface PriorityBadgeProps {
  priority: Priority;
}

export const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  const colors = {
    Low: "bg-teal-100 text-teal-700 border-teal-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200",
    High: "bg-rose-100 text-rose-700 border-rose-200",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold tracking-wide shadow-sm ${colors[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
};

