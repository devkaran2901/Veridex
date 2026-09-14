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
    <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="neo-box p-6 bg-[#d8b4fe] border-3 border-black shadow-[6px_6px_0px_0px_#000000] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-black flex items-center gap-2">
            <Brain className="w-7 h-7 text-black stroke-[3]" /> Long-Term User Memories
          </h2>
          <p className="text-xs font-bold text-black/80 mt-1">
            User preferences, facts, and past decisions stored with pgvector 1536-dim embeddings.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="neo-btn neo-btn-primary text-xs font-black uppercase py-2.5 px-4 flex items-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Add Memory
        </button>
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="neo-box p-6 bg-white border-4 border-black shadow-[10px_10px_0px_0px_#000000] w-full max-w-md space-y-4">
            <h3 className="text-xl font-black uppercase text-black flex items-center gap-2 border-b-3 border-black pb-3">
              <Brain className="w-6 h-6 text-black stroke-[3]" /> Add Long-Term Memory
            </h3>
            <form onSubmit={handleAddMemory} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-black mb-1">Memory Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g. 'User prefers train travel over driving during bad weather'"
                  className="neo-input w-full h-24 p-3 text-xs text-black font-bold outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-black mb-1">Type</label>
                  <select
                    value={memoryType}
                    onChange={(e: any) => setMemoryType(e.target.value)}
                    className="neo-input w-full py-2 px-3 text-xs text-black font-bold outline-none cursor-pointer"
                  >
                    <option value="preference">Preference</option>
                    <option value="semantic">Semantic Fact</option>
                    <option value="episodic">Episodic Event</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-black mb-1">Importance</label>
                  <select
                    value={importance}
                    onChange={(e: any) => setImportance(e.target.value)}
                    className="neo-input w-full py-2 px-3 text-xs text-black font-bold outline-none cursor-pointer"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t-3 border-black">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="neo-btn bg-white hover:bg-gray-100 text-black text-xs font-black uppercase py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="neo-btn neo-btn-primary text-xs font-black uppercase py-2 px-4"
                >
                  {saving ? 'Saving...' : 'Save to pgvector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Memory Search Playground */}
      <div className="neo-box p-5 bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000000] space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-black flex items-center gap-2">
          <Search className="w-5 h-5 text-black stroke-[3]" /> Memory Vector Search Playground
        </h3>
        <form onSubmit={handleSearch} className="flex gap-3 flex-col sm:flex-row">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Test query (e.g., 'What are my preferences for travelling?')"
            className="neo-input flex-1 py-2.5 px-4 text-xs font-bold text-black placeholder-gray-500 outline-none"
          />
          <button
            type="submit"
            disabled={searching}
            className="neo-btn neo-btn-secondary text-xs font-black uppercase py-2.5 px-4"
          >
            {searching ? 'Searching...' : 'Search Memory'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-black uppercase text-black">Relevant Memories:</div>
            {searchResults.map((mem, i) => (
              <div key={i} className="neo-box p-3 bg-[#fef08a] border-2 border-black text-xs space-y-1">
                <div className="flex items-center justify-between text-black font-bold">
                  <span>[{mem.memoryType}] {mem.content}</span>
                  <span className="neo-badge bg-[#a3e635] text-black font-mono">Score: {mem.score}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Memory List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {memories.length === 0 ? (
          <div className="col-span-2 neo-box p-12 bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000000] text-center space-y-3">
            <Brain className="w-12 h-12 mx-auto text-black stroke-[2.5]" />
            <p className="font-black text-lg text-black uppercase">No long-term memories saved yet.</p>
            <p className="text-xs font-bold text-black/70">
              Click "+ Add Memory" above or ask the agent a question to save preferences!
            </p>
          </div>
        ) : (
          memories.map((mem) => (
            <div
              key={mem.id}
              className="neo-box p-5 bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000000] flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="neo-badge bg-[#ffe600] text-black text-xs font-mono">
                    {mem.memory_type}
                  </span>
                  <span className="neo-badge bg-[#ff6b5b] text-black text-[10px]">
                    {mem.importance} Importance
                  </span>
                </div>
                <p className="text-sm text-black leading-relaxed font-bold">
                  "{mem.content}"
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t-2 border-black text-xs font-bold text-black">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                  {new Date(mem.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleDelete(mem.id)}
                  className="neo-btn bg-[#ff6b5b] text-black p-1.5"
                >
                  <Trash2 className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
