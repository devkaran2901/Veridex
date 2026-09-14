import React from 'react';
import { Settings, Key, Server, Database, ShieldCheck } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 bg-[#f4f1ea] text-[#1c1917]">
      {/* Header Banner */}
      <div className="bauhaus-card p-6 bg-[#1c1917] text-white border-2 border-[#1c1917] shadow-bauhaus">
        <h2 className="text-xl font-extrabold uppercase tracking-tight text-white flex items-center gap-2 font-display">
          <Settings className="w-6 h-6 text-[#e63946] stroke-[2.5]" /> System Settings & Credentials
        </h2>
        <p className="text-xs font-bold opacity-80 mt-1">
          Configure API credentials, vector embeddings, and database provider connections.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* OpenAI API Configuration */}
        <div className="bauhaus-card p-6 bg-white border-2 border-[#1c1917] shadow-bauhaus space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e63946] text-white border border-[#1c1917] flex items-center justify-center">
              <Key className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold uppercase text-[#1c1917] text-xs font-display">OpenAI API Key</h3>
              <p className="text-xs font-bold text-[#1c1917]/70">Required for LangGraph tool reasoning and vector embeddings.</p>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="password"
              value="sk-proj-********************************"
              disabled
              className="bauhaus-input w-full py-2.5 px-4 text-[#1c1917] text-xs font-mono font-bold"
            />
            <p className="text-[10px] font-bold text-[#1c1917]/70">
              Configured via root <code className="bg-[#fbbf24] px-1 py-0.5 border border-[#1c1917] text-[#1c1917] font-mono">.env</code> file (`OPENAI_API_KEY`). Mock fallback mode is active if key is unset.
            </p>
          </div>
        </div>

        {/* Database Configuration */}
        <div className="bauhaus-card p-6 bg-white border-2 border-[#1c1917] shadow-bauhaus space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2563eb] text-white border border-[#1c1917] flex items-center justify-center">
              <Database className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold uppercase text-[#1c1917] text-xs font-display">PostgreSQL + pgvector Container</h3>
              <p className="text-xs font-bold text-[#1c1917]/70">Host: localhost:5432 | DB: veridex_db</p>
            </div>
          </div>
          <div className="p-3 bg-[#e63946] text-white border border-[#1c1917] rounded-lg text-xs font-extrabold uppercase flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-white stroke-[2.5]" />
            <span>HNSW Cosine Vector Indexing enabled (`vector_cosine_ops`).</span>
          </div>
        </div>
      </div>
    </div>
  );
};
