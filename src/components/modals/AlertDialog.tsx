import React from 'react';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  type?: 'success' | 'error' | 'info' | 'warning';
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确定',
  onConfirm,
  type = 'info',
}) => {
  if (!isOpen) return null;

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return { icon: '✅', color: 'text-green-600', bg: 'bg-green-50' };
      case 'error':
        return { icon: '❌', color: 'text-red-600', bg: 'bg-red-50' };
      case 'warning':
        return { icon: '⚠️', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      default:
        return { icon: 'ℹ️', color: 'text-blue-600', bg: 'bg-blue-50' };
    }
  };

  const { icon, color, bg } = getIconAndColor();

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={`text-3xl ${bg} p-2 rounded-xl`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className={`text-xl font-bold ${color} mb-2`}>
              {title}
            </h3>
            <div className="text-stone-600 whitespace-pre-line">
              {message}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={onConfirm}
            className="px-6 py-2 rounded-xl font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

