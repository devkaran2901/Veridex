import React from 'react';
import { Settings, Key, Server, Database, ShieldCheck } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="neo-box p-6 bg-[#ffe600] border-3 border-black shadow-[6px_6px_0px_0px_#000000]">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black flex items-center gap-2">
          <Settings className="w-7 h-7 text-black stroke-[3]" /> System Settings & Credentials
        </h2>
        <p className="text-xs font-bold text-black/80 mt-1">
          Configure API credentials, vector embeddings, and database provider connections.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* OpenAI API Configuration */}
        <div className="neo-box p-6 bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000000] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#a3e635] border-3 border-black flex items-center justify-center text-black shadow-[3px_3px_0px_0px_#000000]">
              <Key className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h3 className="font-black uppercase text-black text-sm">OpenAI API Key</h3>
              <p className="text-xs font-bold text-black/70">Required for LangGraph tool reasoning and vector embeddings.</p>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="password"
              value="sk-proj-********************************"
              disabled
              className="neo-input w-full py-2.5 px-4 text-black text-xs font-mono font-bold"
            />
            <p className="text-[11px] font-bold text-black/70">
              Configured via root <code className="bg-[#fef08a] px-1 py-0.5 border border-black text-black font-mono">.env</code> file (`OPENAI_API_KEY`). Mock fallback mode is active if key is unset.
            </p>
          </div>
        </div>

        {/* Database Configuration */}
        <div className="neo-box p-6 bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000000] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#38bdf8] border-3 border-black flex items-center justify-center text-black shadow-[3px_3px_0px_0px_#000000]">
              <Database className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h3 className="font-black uppercase text-black text-sm">PostgreSQL + pgvector Container</h3>
              <p className="text-xs font-bold text-black/70">Host: localhost:5432 | DB: veridex_db</p>
            </div>
          </div>
          <div className="neo-box p-3 bg-[#a3e635] border-2 border-black text-xs text-black font-black uppercase flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-black stroke-[3]" />
            <span>HNSW Cosine Vector Indexing enabled (`vector_cosine_ops`).</span>
          </div>
        </div>
      </div>
    </div>
  );
};
