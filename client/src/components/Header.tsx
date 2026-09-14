import React, { useEffect, useState } from 'react';
import { Wifi, Database, User, ShieldCheck, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  dbConnected: boolean;
  socketConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ dbConnected, socketConnected }) => {
  const [dataMode, setDataMode] = useState<'live' | 'demo'>('live');

  useEffect(() => {
    fetch('/api/ingestion/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.dataMode) {
          setDataMode(data.dataMode);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="h-16 bg-[#f4f1ea] border-b-2 border-[#1c1917] px-6 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-extrabold text-[#1c1917] uppercase tracking-wider font-display">
          AI Intelligence Agent Workstation
        </h2>
        <span className="bauhaus-badge bg-[#2563eb] text-white">
          LangGraph.js v0.2
        </span>

        {/* Data Mode Badge */}
        {dataMode === 'live' ? (
          <span className="bauhaus-badge bg-[#e63946] text-white flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" /> DATA MODE: LIVE
          </span>
        ) : (
          <span className="bauhaus-badge bg-[#fbbf24] text-black flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" /> DATA MODE: DEMO
          </span>
        )}
      </div>

      {/* System Status Indicators */}
      <div className="flex items-center gap-3 text-xs font-extrabold">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border-2 border-[#1c1917]">
          <Database className={`w-3.5 h-3.5 stroke-[2.5] ${dbConnected ? 'text-[#e63946]' : 'text-gray-400'}`} />
          <span className="text-[#1c1917] text-[10px] uppercase">PGVECTOR:</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase ${dbConnected ? 'bg-[#e63946] text-white' : 'bg-gray-200 text-black'}`}>
            {dbConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border-2 border-[#1c1917]">
          <Wifi className={`w-3.5 h-3.5 stroke-[2.5] ${socketConnected ? 'text-[#2563eb]' : 'text-amber-500'}`} />
          <span className="text-[#1c1917] text-[10px] uppercase">STREAM:</span>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-extrabold uppercase ${socketConnected ? 'bg-[#2563eb] text-white' : 'bg-[#fbbf24] text-black'}`}>
            {socketConnected ? 'LIVE' : 'WAITING'}
          </span>
        </div>

        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-[#1c1917] text-white border-2 border-[#1c1917] flex items-center justify-center font-extrabold">
            <User className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>
      </div>
    </header>
  );
};
