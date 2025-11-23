import React from 'react';
import { Modal } from '../common/Modal';
import { XIcon, SparklesIcon } from '../icons';
import { mockRPGStats, mockRPGDetails } from '../../constants';
import { getRarityColor } from '../../utils/helpers';

interface RPGDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RPGDetailModal = ({ isOpen, onClose }: RPGDetailModalProps) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col max-h-full min-h-0 bg-gradient-to-br from-violet-50/50 via-white to-fuchsia-50/50">
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-white/60 flex-shrink-0">
                <h3 className="font-black text-xl text-stone-700 flex items-center gap-2">
                    <span className="text-2xl">🧙‍♂️</span> 角色详情
                </h3>
                <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-2 rounded-xl hover:bg-stone-100 transition-all">
                  <XIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar modal-body">
                {/* Top Section: Stats & Equipment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    
                    {/* Left: Avatar & Basic Stats */}
                    <div className="space-y-4 text-center">
                        <div className="w-32 h-32 bg-white rounded-[2rem] mx-auto flex items-center justify-center text-6xl shadow-[0_10px_40px_-10px_rgba(124,58,237,0.3)] border-4 border-white ring-4 ring-violet-100 transform hover:scale-105 transition-transform">
                            🧙‍♂️
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-stone-800">{mockRPGStats.title}</h2>
                            <p className="text-violet-500 font-bold">Lv.{mockRPGStats.level}</p>
                        </div>
                         <div className="bg-white/60 p-4 rounded-2xl border border-white/60 shadow-sm text-left space-y-3">
                            {[
                                { label: "代码力", val: mockRPGStats.strength, icon: "💻" },
                                { label: "沟通力", val: mockRPGStats.charisma, icon: "💬" },
                                { label: "专注度", val: mockRPGStats.wisdom, icon: "🧠" },
                                { label: "摸鱼值", val: mockRPGStats.chaos, icon: "🤪" },
                            ].map(s => (
                                <div key={s.label} className="flex items-center justify-between text-sm">
                                    <span className="text-stone-500 font-bold flex items-center gap-2">{s.icon} {s.label}</span>
                                    <span className="font-mono font-bold text-stone-700">{s.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Equipment Slots */}
                    <div className="space-y-4">
                         <h4 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-2">当前装备</h4>
                         <div className="grid grid-cols-1 gap-3">
                            {mockRPGDetails.items.map(item => (
                                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${getRarityColor(item.rarity)} bg-opacity-40 hover:bg-opacity-60 transition-colors group cursor-pointer`}>
                                    <div className="w-10 h-10 flex items-center justify-center bg-white rounded-xl text-xl shadow-sm">
                                        {item.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-stone-700 text-sm">{item.name}</span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/50 uppercase opacity-70">{item.type}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                             <span className="text-[10px] text-stone-500">{item.desc}</span>
                                             <span className="text-[10px] font-bold text-emerald-600">{item.bonus}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>

                {/* Skills Section */}
                <div>
                     <h4 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4" />
                        技能树
                     </h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {mockRPGDetails.skills.map(skill => (
                            <div key={skill.id} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                        {skill.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h5 className="font-bold text-stone-700 text-sm">{skill.name}</h5>
                                            <span className="text-[10px] font-bold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Lv.{skill.level}/{skill.maxLevel}</span>
                                        </div>
                                        <p className="text-xs text-stone-400 leading-snug">{skill.description}</p>
                                        
                                        {/* Skill Bar */}
                                        <div className="mt-3 h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${(skill.level / skill.maxLevel) * 100}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                     </div>
                </div>

            </div>
        </div>
    </Modal>
  );
};

