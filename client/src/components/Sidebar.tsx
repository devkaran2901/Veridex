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
    { id: 'chat', label: 'Chat Assistant', icon: MessageSquare, color: 'bg-[#e63946] text-white' },
    { id: 'sources', label: 'Data Sources', icon: Server, color: 'bg-[#2563eb] text-white' },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database, color: 'bg-[#fbbf24] text-black' },
    { id: 'memories', label: 'Long-Term Memory', icon: Brain, color: 'bg-[#1c1917] text-white' },
    { id: 'runs', label: 'Agent Runs Trace', icon: Activity, color: 'bg-[#e63946] text-white' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'bg-[#2563eb] text-white' },
  ];

  return (
    <aside className="w-64 bg-[#f4f1ea] border-2 border-[#1c1917] rounded-lg h-full flex flex-col justify-between p-4 flex-shrink-0 z-20 shadow-bauhaus">
      <div className="flex flex-col gap-5">
        {/* Bauhaus Geometric Brand Header */}
        <div className="flex items-center gap-3 px-1 pt-1 border-b-2 border-[#1c1917] pb-4">
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 bg-[#e63946] inline-block border border-[#1c1917]" />
            <span className="w-4 h-4 bg-[#2563eb] rounded-full inline-block border border-[#1c1917]" />
            <span className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-[#fbbf24] inline-block" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-[#1c1917] tracking-tight uppercase font-display">
              VERIDEX
            </h1>
            <span className="text-[9px] font-bold uppercase tracking-widest bg-[#1c1917] text-white px-2 py-0.5 rounded-full inline-block">
              AGENTIC RAG
            </span>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full py-2.5 px-4 bauhaus-btn-accent text-white font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 text-xs shadow-sm"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Chat</span>
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5 pt-1">
          <div className="text-[10px] font-bold text-[#1c1917]/70 uppercase tracking-widest px-2 mb-1">
            Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider border-2 border-[#1c1917] transition-all ${
                  isActive
                    ? 'bg-[#1c1917] text-white shadow-[2px_2px_0px_0px_#e63946]'
                    : 'bg-white text-[#1c1917] hover:bg-[#e63946] hover:text-white'
                }`}
              >
                <div className={`p-1 rounded-full ${item.color} border border-[#1c1917]`}>
                  <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
