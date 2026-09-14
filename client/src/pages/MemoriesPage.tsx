import React, { useEffect, useState } from 'react';
import { Brain, Trash2, Tag, Calendar, Plus, Search, Sparkles, CheckCircle } from 'lucide-react';

interface MemoryItem {
  id: string;
  memory_type: 'semantic' | 'episodic' | 'preference';
  content: string;
  importance: 'low' | 'medium' | 'high';
  created_at: string;
}

export const MemoriesPage: React.FC = () => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [content, setContent] = useState('');
  const [memoryType, setMemoryType] = useState<'preference' | 'semantic' | 'episodic'>('preference');
  const [importance, setImportance] = useState<'low' | 'medium' | 'high'>('high');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/memories');
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setSaving(true);
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, memoryType, importance }),
      });

      if (res.ok) {
        setContent('');
        setShowAddModal(false);
        await fetchMemories();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMemories(memories.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const res = await fetch('/api/memories/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.memories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0b0f19]/60 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" /> Long-Term User Memories
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            User preferences, facts, and past decisions stored with pgvector 1536-dim embeddings.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg shadow-purple-600/20"
        >
          <Plus className="w-4 h-4" /> Add Memory
        </button>
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-gray-800 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" /> Add Long-Term Memory
            </h3>
            <form onSubmit={handleAddMemory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Memory Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g. 'User prefers train travel over driving during bad weather'"
                  className="w-full h-24 p-3 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Type</label>
                  <select
                    value={memoryType}
                    onChange={(e: any) => setMemoryType(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none"
                  >
                    <option value="preference">Preference</option>
                    <option value="semantic">Semantic Fact</option>
                    <option value="episodic">Episodic Event</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Importance</label>
                  <select
                    value={importance}
                    onChange={(e: any) => setImportance(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium"
                >
                  {saving ? 'Saving...' : 'Save to pgvector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Memory Search Playground */}
      <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-purple-400" /> Memory Vector Search
        </h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Test query (e.g., 'What are my preferences for travelling?')"
            className="flex-1 py-2 px-4 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-medium"
          >
            {searching ? 'Searching...' : 'Search Memory'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-gray-400">Relevant Memories:</div>
            {searchResults.map((mem, i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-900 border border-gray-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-purple-300 font-medium">
                  <span>[{mem.memoryType}] {mem.content}</span>
                  <span className="font-mono text-emerald-400">Score: {mem.score}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Memory List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {memories.length === 0 ? (
          <div className="col-span-2 p-12 glass-panel rounded-2xl text-center text-gray-500 space-y-2">
            <Brain className="w-10 h-10 mx-auto text-purple-400/40" />
            <p className="font-medium text-gray-300">No long-term memories saved yet.</p>
            <p className="text-xs">
              Click "+ Add Memory" above or ask the agent a question to save preferences!
            </p>
          </div>
        ) : (
          memories.map((mem) => (
            <div
              key={mem.id}
              className="p-5 glass-card rounded-2xl border border-gray-800 flex flex-col justify-between gap-4 hover:border-purple-500/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase">
                    {mem.memory_type}
                  </span>
                  <span className="text-[11px] font-semibold text-amber-400 uppercase">
                    {mem.importance} Importance
                  </span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                  "{mem.content}"
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(mem.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleDelete(mem.id)}
                  className="text-gray-500 hover:text-rose-400 p-1 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
