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
    <header className="h-16 bg-white border-b-3 border-black px-6 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-black text-black uppercase tracking-wider">
          AI Intelligence Agent Workstation
        </h2>
        <span className="neo-badge bg-[#38bdf8] text-black">
          LangGraph.js v0.2
        </span>

        {/* Data Mode Badge */}
        {dataMode === 'live' ? (
          <span className="neo-badge bg-[#ccff00] text-black flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" /> DATA MODE: LIVE (AUTHENTIC)
          </span>
        ) : (
          <span className="neo-badge bg-[#ffe600] text-black flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" /> DATA MODE: DEMO (TEST DATA)
          </span>
        )}
      </div>

      {/* System Status Indicators */}
      <div className="flex items-center gap-4 text-xs font-bold">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <Database className={`w-4 h-4 stroke-[2.5] ${dbConnected ? 'text-emerald-600' : 'text-rose-600'}`} />
          <span className="text-black uppercase">PGVECTOR:</span>
          <span className={`px-2 py-0.5 rounded-md border border-black font-black uppercase ${dbConnected ? 'bg-[#ccff00] text-black' : 'bg-[#ff6b5b] text-black'}`}>
            {dbConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <Wifi className={`w-4 h-4 stroke-[2.5] ${socketConnected ? 'text-emerald-600' : 'text-amber-600'}`} />
          <span className="text-black uppercase">STREAM:</span>
          <span className={`px-2 py-0.5 rounded-md border border-black font-black uppercase ${socketConnected ? 'bg-[#ccff00] text-black' : 'bg-[#ffe600] text-black'}`}>
            {socketConnected ? 'LIVE' : 'WAITING'}
          </span>
        </div>

        <div className="flex items-center gap-2 pl-2">
          <div className="w-9 h-9 rounded-xl bg-[#ff6b5b] border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black font-black">
            <User className="w-5 h-5 stroke-[2.5]" />
          </div>
        </div>
      </div>
    </header>
  );
};
