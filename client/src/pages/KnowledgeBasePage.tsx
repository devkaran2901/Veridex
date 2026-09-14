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
    <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 bg-[#f4f1ea] text-[#1c1917]">
      {/* Header Banner */}
      <div className="bauhaus-card p-6 bg-[#fbbf24] border-2 border-[#1c1917] shadow-bauhaus flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold uppercase tracking-tight text-[#1c1917] flex items-center gap-2 font-display">
              <Database className="w-6 h-6 text-[#1c1917] stroke-[2.5]" /> Veridex Knowledge Layer
            </h2>
            {statusInfo && (
              <span className={`bauhaus-badge text-xs ${
                statusInfo.dataMode === 'live' 
                  ? 'bg-[#e63946] text-white' 
                  : 'bg-[#2563eb] text-white'
              }`}>
                {statusInfo.dataMode === 'live' ? <Shield className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                MODE: {statusInfo.dataMode?.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-[#1c1917]/80 mt-1">
            Continuous Live Government Ingestion Pipeline (IMD, data.gov.in, NDMA) + PostgreSQL pgvector Hybrid Retrieval.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSyncIngestion}
            disabled={syncing}
            className="bauhaus-btn text-xs font-extrabold uppercase py-2.5 px-4 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Ingesting Feeds...' : 'Sync Feeds Now'}
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
            className="bauhaus-btn-accent text-xs font-extrabold uppercase py-2.5 px-4 flex items-center gap-2"
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
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSubTab('live')}
          className={`py-2 px-4 rounded-full text-xs font-extrabold uppercase border-2 border-[#1c1917] transition-all flex items-center gap-2 ${
            activeSubTab === 'live'
              ? 'bg-[#1c1917] text-white'
              : 'bg-white text-[#1c1917] hover:bg-[#eae6df]'
          }`}
        >
          <Sparkles className="w-4 h-4 stroke-[2.5]" /> Live Knowledge ({knowledgeRecords.length})
        </button>

        <button
          onClick={() => setActiveSubTab('static')}
          className={`py-2 px-4 rounded-full text-xs font-extrabold uppercase border-2 border-[#1c1917] transition-all flex items-center gap-2 ${
            activeSubTab === 'static'
              ? 'bg-[#2563eb] text-white'
              : 'bg-white text-[#1c1917] hover:bg-[#eae6df]'
          }`}
        >
          <FileText className="w-4 h-4 stroke-[2.5]" /> Static Documents ({documents.length})
        </button>
      </div>

      {/* SUB-TAB 1: LIVE INGESTED KNOWLEDGE LAYER */}
      {activeSubTab === 'live' && (
        <div className="space-y-6">
          {/* Government Datasets Explorer Cards */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1c1917] mb-3 flex items-center gap-2 font-display">
              <Tag className="w-4 h-4 text-[#e63946]" /> Open Datasets Catalog ({datasets.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {datasets.map((ds) => (
                <div key={ds.id} className="bauhaus-card p-4 bg-white border-2 border-[#1c1917] shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bauhaus-badge bg-[#2563eb] text-white text-[9px]">
                      {ds.source}
                    </span>
                    <span className="text-[10px] font-bold text-[#1c1917]/70 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#1c1917]" /> Live Synced
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-[#1c1917] leading-snug font-display">{ds.name}</h4>
                  <p className="text-xs font-medium text-[#1c1917]/70 line-clamp-2">{ds.description}</p>
                  <div className="pt-2 flex items-center justify-between border-t border-[#1c1917] text-xs font-bold text-[#1c1917]">
                    <span>Records: <strong className="text-[#e63946] text-sm">{ds.record_count}</strong></span>
                    {ds.is_mock && <span className="bauhaus-badge bg-[#fbbf24] text-black text-[9px]">DEMO REGISTRY</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ingested Knowledge Records Table */}
          <div className="bauhaus-card bg-white border-2 border-[#1c1917] shadow-bauhaus overflow-hidden">
            <div className="p-4 bg-[#1c1917] text-white border-b-2 border-[#1c1917] flex items-center justify-between">
              <span className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-2 font-display">
                <Shield className="w-4 h-4 text-[#e63946] stroke-[2.5]" /> pgvector Knowledge Records ({knowledgeRecords.length})
              </span>
              <span className="bauhaus-badge bg-[#fbbf24] text-black text-[10px]">
                SHA-256 Deduplicated
              </span>
            </div>

            {knowledgeRecords.length === 0 ? (
              <div className="p-8 text-center text-[#1c1917] font-bold text-xs bg-white">
                No live knowledge records loaded yet. Click "Sync Feeds Now" above to trigger ingestion pipeline.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#1c1917]">
                  <thead className="bg-[#eae6df] border-b-2 border-[#1c1917] text-[10px] font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 border-r border-[#1c1917]">Source</th>
                      <th className="p-3 border-r border-[#1c1917]">Title</th>
                      <th className="p-3 border-r border-[#1c1917]">Version</th>
                      <th className="p-3 border-r border-[#1c1917]">Freshness</th>
                      <th className="p-3">Valid From</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-[#1c1917] font-medium">
                    {knowledgeRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#eae6df] text-xs">
                        <td className="p-3 font-mono font-bold text-[#1c1917] border-r border-[#1c1917]">{rec.source}</td>
                        <td className="p-3 font-bold text-[#1c1917] max-w-sm truncate border-r border-[#1c1917]">{rec.title}</td>
                        <td className="p-3 border-r border-[#1c1917]">
                          <span className="bauhaus-badge bg-[#2563eb] text-white text-[9px]">
                            v{rec.version || 1}
                          </span>
                        </td>
                        <td className="p-3 border-r border-[#1c1917]">
                          <span className="bauhaus-badge bg-[#e63946] text-white text-[9px] flex items-center gap-1 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            FRESH
                          </span>
                        </td>
                        <td className="p-3 text-[#1c1917] font-mono font-bold">{new Date(rec.valid_from).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            className="bauhaus-card p-8 bg-white border-2 border-dashed border-[#1c1917] shadow-bauhaus text-center space-y-3 cursor-pointer hover:bg-[#eae6df] transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-[#e63946] text-white border-2 border-[#1c1917] flex items-center justify-center mx-auto shadow-sm">
              <Upload className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="text-sm font-extrabold uppercase text-[#1c1917] font-display">
              Click or Drag PDF / TXT files here to upload
            </div>
            <p className="text-xs font-bold text-[#1c1917]/70 max-w-md mx-auto">
              Files are broken into overlapping chunks, embedded with 1536-dim vectors, and indexed in PostgreSQL pgvector.
            </p>
          </div>

          {/* Indexed Documents Table */}
          <div className="bauhaus-card bg-white border-2 border-[#1c1917] shadow-bauhaus overflow-hidden">
            <div className="p-4 bg-[#2563eb] text-white border-b-2 border-[#1c1917] font-extrabold text-xs uppercase tracking-wide font-display">
              Indexed Documents ({documents.length})
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center text-[#1c1917] font-bold text-xs bg-white">
                No static documents uploaded yet. Upload a PDF or TXT file above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#1c1917]">
                  <thead className="bg-[#eae6df] border-b-2 border-[#1c1917] text-[10px] font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 border-r border-[#1c1917]">Document Title</th>
                      <th className="p-3 border-r border-[#1c1917]">Size</th>
                      <th className="p-3 border-r border-[#1c1917]">Chunks</th>
                      <th className="p-3 border-r border-[#1c1917]">Status</th>
                      <th className="p-3 border-r border-[#1c1917]">Uploaded</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-[#1c1917] font-medium">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#eae6df] text-xs">
                        <td className="p-3 font-bold text-[#1c1917] flex items-center gap-2 border-r border-[#1c1917]">
                          <FileText className="w-4 h-4 text-[#1c1917] stroke-[2.5]" />
                          {doc.title}
                        </td>
                        <td className="p-3 text-[#1c1917] font-mono font-bold border-r border-[#1c1917]">{(doc.file_size / 1024).toFixed(1)} KB</td>
                        <td className="p-3 font-mono font-bold text-[#1c1917] border-r border-[#1c1917]">{doc.chunk_count} chunks</td>
                        <td className="p-3 border-r border-[#1c1917]">
                          <span className="bauhaus-badge bg-[#e63946] text-white text-[9px] flex items-center gap-1 w-max">
                            <CheckCircle className="w-3.5 h-3.5 stroke-[2.5]" /> {doc.status}
                          </span>
                        </td>
                        <td className="p-3 text-[#1c1917] font-mono font-bold border-r border-[#1c1917]">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1 rounded-full bg-[#e63946] text-white border border-[#1c1917] hover:bg-black transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
