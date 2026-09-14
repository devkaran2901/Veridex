import React from 'react';
import { Settings, Key, Server, Database, ShieldCheck } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0b0f19]/60 space-y-6">
      <div className="border-b border-gray-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" /> System Settings & Credentials
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Configure API credentials, vector embeddings, and database provider connections.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* OpenAI API Configuration */}
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">OpenAI API Key</h3>
              <p className="text-xs text-gray-400">Required for LangGraph tool reasoning and vector embeddings.</p>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="password"
              value="sk-proj-********************************"
              disabled
              className="w-full py-2.5 px-4 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 text-xs font-mono"
            />
            <p className="text-[11px] text-gray-500">
              Configured via root <code className="text-indigo-400">.env</code> file (`OPENAI_API_KEY`). Mock fallback mode is active if key is unset.
            </p>
          </div>
        </div>

        {/* Database Configuration */}
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">PostgreSQL + pgvector Container</h3>
              <p className="text-xs text-gray-400">Host: localhost:5432 | DB: veridex_db</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>HNSW Cosine Vector Indexing enabled (`vector_cosine_ops`).</span>
          </div>
        </div>
      </div>
    </div>
  );
};
