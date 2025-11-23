import React from 'react';
import { getTagColors } from '../../utils/helpers';
import { XIcon } from '../icons';

interface TagPillProps {
  text: string;
  onRemove?: () => void;
}

export const TagPill = ({ text, onRemove }: TagPillProps) => {
  const colorClass = getTagColors(text);
  return (
    <span className={`flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full border shadow-sm transition-all hover:brightness-95 ${colorClass}`}>
      #{text}
      {onRemove && (
        <button onClick={onRemove} className="ml-1 hover:text-current opacity-60 hover:opacity-100">
          <XIcon className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

