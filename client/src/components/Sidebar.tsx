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
    { id: 'chat', label: 'Chat Assistant', icon: MessageSquare },
    { id: 'sources', label: 'Data Sources', icon: Server },
    { id: 'knowledge', label: 'Knowledge Base', icon: Database },
    { id: 'memories', label: 'Long-Term Memory', icon: Brain },
    { id: 'runs', label: 'Agent Runs Trace', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 glass-panel h-screen flex flex-col justify-between p-4 border-r border-gray-800 flex-shrink-0">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-wide flex items-center gap-1.5">
              VERIDEX <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            </h1>
            <p className="text-xs text-gray-400 font-medium">Agentic RAG Engine</p>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 hover:shadow-indigo-500/40 active:scale-98"
        >
          <Plus className="w-5 h-5" />
          <span>New Chat</span>
        </button>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-1">
            Dashboard Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Student Project Badge */}
      <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          BTech Final Project
        </div>
        <p className="text-[11px] text-gray-400 leading-tight">
          LangGraph Agentic RAG over Live APIs, pgvector & Memory
        </p>
      </div>
    </aside>
  );
};
