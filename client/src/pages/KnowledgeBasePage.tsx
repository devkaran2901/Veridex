import React, { useEffect, useState, useRef } from 'react';
import { Upload, FileText, Trash2, Database, CheckCircle, Clock, RefreshCw, Sparkles, Shield, Tag, AlertTriangle } from 'lucide-react';

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

interface DatasetItem {
  id: string;
  name: string;
  source: string;
  publisher?: string;
  description: string;
  last_synced_at?: string;
  record_count: number;
  is_mock?: boolean;
}

interface KnowledgeRecordItem {
  id: string;
  source: string;
  source_type: string;
  dataset_id: string;
  title: string;
  content: string;
  structured_data: any;
  valid_from: string;
  observed_at?: string;
  version?: number;
}

export const KnowledgeBasePage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'static'>('live');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [knowledgeRecords, setKnowledgeRecords] = useState<KnowledgeRecordItem[]>([]);
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docRes, dsRes, recRes, statusRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/ingestion/datasets'),
        fetch('/api/ingestion/records'),
        fetch('/api/ingestion/status'),
      ]);

      if (docRes.ok) setDocuments(await docRes.json());
      if (dsRes.ok) setDatasets(await dsRes.json());
      if (recRes.ok) setKnowledgeRecords(await recRes.json());
      if (statusRes.ok) setStatusInfo(await statusRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncIngestion = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/ingestion/sync', { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
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
        await fetchData();
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

  const handleDeleteDoc = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(documents.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0b0f19]/60 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-indigo-400" /> Veridex Knowledge Layer
            </h2>
            {statusInfo && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border ${
                statusInfo.dataMode === 'live' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {statusInfo.dataMode === 'live' ? <Shield className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                Mode: {statusInfo.dataMode?.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Continuous Live Government Ingestion Pipeline (IMD, data.gov.in, NDMA) + PostgreSQL pgvector Hybrid Retrieval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncIngestion}
            disabled={syncing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Ingesting Live Feeds...' : 'Sync Live Feeds Now'}
          </button>

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
                <Clock className="w-4 h-4 animate-spin" /> Chunking...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" /> Upload Document
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-4 border-b border-gray-800/80">
        <button
          onClick={() => setActiveSubTab('live')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 transition-all border-b-2 ${
            activeSubTab === 'live'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Live Ingested Knowledge Layer ({knowledgeRecords.length})
        </button>

        <button
          onClick={() => setActiveSubTab('static')}
          className={`pb-3 font-semibold text-sm flex items-center gap-2 transition-all border-b-2 ${
            activeSubTab === 'static'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" /> Static Document Uploads ({documents.length})
        </button>
      </div>

      {/* SUB-TAB 1: LIVE INGESTED KNOWLEDGE LAYER */}
      {activeSubTab === 'live' && (
        <div className="space-y-6">
          {/* Government Datasets Explorer Cards */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Government Open Datasets Registry & Provider Catalog
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {datasets.map((ds) => (
                <div key={ds.id} className="p-4 glass-card rounded-2xl border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {ds.source}
                    </span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Live Synced
                    </span>
                  </div>
                  <h4 className="font-semibold text-xs text-white leading-snug">{ds.name}</h4>
                  <p className="text-[11px] text-gray-400 line-clamp-2">{ds.description}</p>
                  <div className="pt-2 flex items-center justify-between border-t border-gray-800/60 text-[10px] text-gray-500">
                    <span>Records: <strong className="text-indigo-400">{ds.record_count}</strong></span>
                    {ds.is_mock && <span className="text-amber-400 font-mono">[DEMO REGISTRY]</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ingested Knowledge Records Table */}
          <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-200 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> PostgreSQL pgvector Knowledge Records ({knowledgeRecords.length})
              </span>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                SHA-256 Deduplication & Versioning Active
              </span>
            </div>

            {knowledgeRecords.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No live knowledge records loaded yet. Click "Sync Live Feeds Now" above to trigger ingestion pipeline.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-gray-900/80 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Source</th>
                    <th className="p-4">Title</th>
                    <th className="p-4">Version</th>
                    <th className="p-4">Freshness</th>
                    <th className="p-4">Valid From</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {knowledgeRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-800/30 text-xs">
                      <td className="p-4 font-mono text-indigo-300">{rec.source}</td>
                      <td className="p-4 font-medium text-white max-w-sm truncate">{rec.title}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          v{rec.version || 1}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          🟢 Fresh
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">{new Date(rec.valid_from).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: STATIC DOCUMENT UPLOADS */}
      {activeSubTab === 'static' && (
        <div className="space-y-6">
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
              Files are broken into overlapping chunks, embedded with 1536-dim vectors, and indexed in PostgreSQL pgvector.
            </p>
          </div>

          {/* Indexed Documents Table */}
          <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800 font-semibold text-sm text-gray-200">
              Indexed Documents ({documents.length})
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No static documents uploaded yet. Upload a PDF or TXT file above.
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
                    <tr key={doc.id} className="hover:bg-gray-800/30 text-xs">
                      <td className="p-4 font-medium text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        {doc.title}
                      </td>
                      <td className="p-4 text-gray-400">{(doc.file_size / 1024).toFixed(1)} KB</td>
                      <td className="p-4 font-mono text-indigo-300">{doc.chunk_count} chunks</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-max">
                          <CheckCircle className="w-3.5 h-3.5" /> {doc.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
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
      )}
    </div>
  );
};
