import React, { useEffect, useState, useRef } from 'react';
import { Upload, FileText, Trash2, Database, CheckCircle, Clock, AlertCircle, Sparkles, Search } from 'lucide-react';

interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  status: string;
  created_at: string;
}

export const KnowledgeBasePage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchDocuments();
      } else {
        const errData = await res.json();
        alert(`Upload error: ${errData.error}`);
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(documents.filter((d) => d.id !== id));
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
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.chunks || []);
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
            <Database className="w-6 h-6 text-indigo-400" /> RAG Knowledge Base
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Upload PDF/TXT documents to chunk, embed, and index into PostgreSQL pgvector.
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf,.txt"
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          {uploading ? (
            <>
              <Clock className="w-4 h-4 animate-spin" /> Chunking & Indexing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" /> Upload Document
            </>
          )}
        </button>
      </div>

      {/* Upload Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="p-8 rounded-2xl glass-panel border border-dashed border-gray-700 hover:border-indigo-500/50 text-center space-y-3 cursor-pointer transition-all"
      >
        <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
          <Upload className="w-6 h-6" />
        </div>
        <div className="text-sm font-medium text-gray-200">
          Click or Drag PDF / TXT files here to upload
        </div>
        <p className="text-xs text-gray-500">
          Files are extracted, broken into overlapping chunks, embedded with 1536-dim vectors, and indexed in PostgreSQL pgvector.
        </p>
      </div>

      {/* Semantic Vector Search Playground */}
      <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-400" /> Vector Retrieval Playground
        </h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Test query (e.g., 'What does the government report say about flood management?')"
            className="flex-1 py-2 px-4 rounded-xl bg-gray-900 border border-gray-800 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium"
          >
            {searching ? 'Searching...' : 'Vector Search'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-gray-400">Top Semantic Matches:</div>
            {searchResults.map((res, i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-900 border border-gray-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-indigo-300 font-medium">
                  <span>{res.documentTitle} (Pg {res.pageNumber})</span>
                  <span className="font-mono text-emerald-400">Similarity: {(res.similarity * 100).toFixed(1)}%</span>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed">"{res.content}"</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Indexed Documents Table */}
      <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800 font-semibold text-sm text-gray-200">
          Indexed Documents ({documents.length})
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No documents indexed yet. Upload a PDF or TXT file above to build your Knowledge Base.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/80 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">Document Title</th>
                <th className="p-4">Size</th>
                <th className="p-4">Chunks</th>
                <th className="p-4">Status</th>
                <th className="p-4">Uploaded</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-800/30">
                  <td className="p-4 font-medium text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    {doc.title}
                  </td>
                  <td className="p-4 text-xs text-gray-400">{(doc.file_size / 1024).toFixed(1)} KB</td>
                  <td className="p-4 font-mono text-xs text-indigo-300">{doc.chunk_count} chunks</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-max">
                      <CheckCircle className="w-3.5 h-3.5" /> {doc.status}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-400">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
