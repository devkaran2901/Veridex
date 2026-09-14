import React from 'react';
import { Wifi, Cpu, Database, User } from 'lucide-react';

interface HeaderProps {
  dbConnected: boolean;
  socketConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ dbConnected, socketConnected }) => {
  return (
    <header className="h-16 glass-panel border-b border-gray-800 px-6 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-200">
          AI Intelligence Agent Workstation
        </h2>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          LangGraph.js v0.2
        </span>
      </div>

      {/* System Status Indicators */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800">
          <Database className={`w-3.5 h-3.5 ${dbConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
          <span className="text-gray-300 font-medium">PostgreSQL + pgvector:</span>
          <span className={dbConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
            {dbConnected ? 'Connected' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800">
          <Wifi className={`w-3.5 h-3.5 ${socketConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-gray-300 font-medium">Socket Stream:</span>
          <span className={socketConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
            {socketConnected ? 'Live' : 'Connecting'}
          </span>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
          <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};
