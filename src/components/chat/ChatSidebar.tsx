import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../../types';
import { BotIcon, XIcon, SendIcon, TrashIcon } from '../icons';

interface ChatSidebarProps {
  isOpen: boolean;
  messages: ChatMessage[];
  input: string;
  isStreaming: boolean;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onQuickQuestion: (question: string) => void;
  onClearChat: () => void;
}

export const ChatSidebar = ({
  isOpen,
  messages,
  input,
  isStreaming,
  onClose,
  onInputChange,
  onSubmit,
  onQuickQuestion,
  onClearChat
}: ChatSidebarProps) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  return (
    <aside 
      className={`
        fixed right-6 top-[88px] bottom-6 w-[calc(100%-48px)] sm:w-[400px] glass-panel rounded-3xl shadow-2xl transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) z-30 flex flex-col overflow-hidden border border-white/60
        ${isOpen ? 'translate-x-0' : 'translate-x-[120%]'}
      `}
    >
      <div className="p-4 border-b border-rose-100 bg-gradient-to-r from-rose-50/80 to-amber-50/80 flex justify-between items-center">
         <h3 className="font-bold text-stone-700 flex items-center gap-2">
           <div className="p-1.5 bg-white rounded-lg shadow-sm">
             <BotIcon className="w-5 h-5 text-rose-500" />
           </div>
           项目助理
         </h3>
         <div className="flex items-center gap-2">
           <button 
             onClick={onClearChat}
             title="清空聊天记录"
             className="text-stone-400 hover:text-amber-500 bg-white/50 hover:bg-white p-1.5 rounded-lg transition-all"
           >
             <TrashIcon className="w-4 h-4" />
           </button>
           <button 
             onClick={onClose} 
             className="text-stone-400 hover:text-rose-500 bg-white/50 hover:bg-white p-1.5 rounded-lg transition-all"
           >
             <XIcon className="w-5 h-5" />
           </button>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/40">
         {messages.map((msg) => (
           <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div 
                className={`
                  max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm backdrop-blur-sm
                  ${msg.role === 'user' 
                    ? 'bg-gradient-to-br from-rose-400 to-pink-500 text-white rounded-br-sm shadow-rose-200' 
                    : 'bg-white/90 border border-white text-stone-700 rounded-bl-sm shadow-stone-100'}
                `}
             >
               {msg.text || <div className="flex gap-1 px-2 py-1"><span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce delay-75"></span><span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce delay-150"></span></div>}
             </div>
           </div>
         ))}
         <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-white/60 border-t border-white backdrop-blur-md">
        <form onSubmit={onSubmit} className="relative group">
          <input 
            type="text" 
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="问我任何事情..."
            disabled={isStreaming}
            className="w-full bg-white border border-stone-200/50 rounded-2xl py-3.5 pl-5 pr-12 text-sm focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all shadow-sm group-hover:shadow-md"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 disabled:opacity-50 disabled:bg-stone-300 transition-all shadow-rose-200 hover:shadow-lg active:scale-95"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {["帮我建个任务 ✨", "进度总结 📊", "未完成任务? 🤔"].map(q => (
            <button 
              key={q}
              onClick={() => onQuickQuestion(q)}
              className="text-xs whitespace-nowrap px-3 py-1.5 bg-white border border-stone-100 text-stone-500 rounded-full hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all shadow-sm"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

