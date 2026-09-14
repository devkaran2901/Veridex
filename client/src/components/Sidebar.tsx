import React from 'react';
import { 
  MessageSquare, 
  Database, 
  Server,
  Brain, 
  Activity, 
  Settings, 
  Plus, 
  Sparkles,
  Bot
} from 'lucide-react';

export type ActiveTab = 'chat' | 'sources' | 'knowledge' | 'memories' | 'runs' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onNewChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onNewChat }) => {
  const navItems = [
    { id: 'chat', label: 'Chat Assistant', icon: MessageSquare, color: 'bg-[#ffe600]' },
    { id: 'sources', label: 'Data Sources', icon: Server, color: 'bg-[#ff6b5b]' },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database, color: 'bg-[#38bdf8]' },
    { id: 'memories', label: 'Long-Term Memory', icon: Brain, color: 'bg-[#d8b4fe]' },
    { id: 'runs', label: 'Agent Runs Trace', icon: Activity, color: 'bg-[#f472b6]' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'bg-[#ffffff]' },
  ];

  return (
    <aside className="w-64 neo-box-lime h-full flex flex-col justify-between p-4 flex-shrink-0 z-20">
      <div className="flex flex-col gap-5">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="w-11 h-11 rounded-xl bg-[#ffe600] border-3 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
            <Bot className="w-7 h-7 text-black stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-black text-xl text-black tracking-wider flex items-center gap-1.5 uppercase">
              VERIDEX <Sparkles className="w-4 h-4 text-black fill-[#ff6b5b]" />
            </h1>
            <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-2 py-0.5 rounded-full inline-block">
              AGENTIC RAG
            </span>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full py-3 px-4 neo-btn-coral text-black font-black uppercase tracking-wider flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>New Chat</span>
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2 pt-1">
          <div className="text-[11px] font-black text-black uppercase tracking-widest px-2 mb-0.5">
            NAVIGATION
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-3 border-black transition-all ${
                  isActive
                    ? `${item.color} text-black shadow-[4px_4px_0px_0px_#000] translate-x-[-1px] translate-y-[-1px]`
                    : 'bg-white text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#ffe600] hover:shadow-[4px_4px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                }`}
              >
                <div className={`p-1.5 rounded-lg border-2 border-black ${isActive ? 'bg-white' : item.color}`}>
                  <Icon className="w-4 h-4 text-black stroke-[2.5]" />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Student Project Badge */}
      <div className="p-3 bg-white border-3 border-black shadow-[3px_3px_0px_0px_#000] rounded-xl text-black">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider mb-1">
          <span className="w-3 h-3 rounded-full bg-[#ccff00] border-2 border-black inline-block" />
          BTech Final Project
        </div>
        <p className="text-[11px] font-bold text-gray-800 leading-tight">
          LangGraph RAG over Live APIs, pgvector & Memory
        </p>
      </div>
    </aside>
  );
};
