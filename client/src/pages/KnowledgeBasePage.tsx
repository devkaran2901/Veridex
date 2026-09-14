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
    <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="neo-box p-6 bg-[#ffe600] border-3 border-black shadow-[6px_6px_0px_0px_#000000] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black uppercase tracking-tight text-black flex items-center gap-2">
              <Database className="w-7 h-7 text-black stroke-[3]" /> Veridex Knowledge Layer
            </h2>
            {statusInfo && (
              <span className={`neo-badge text-xs ${
                statusInfo.dataMode === 'live' 
                  ? 'bg-[#a3e635] text-black' 
                  : 'bg-[#ff6b5b] text-black'
              }`}>
                {statusInfo.dataMode === 'live' ? <Shield className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                MODE: {statusInfo.dataMode?.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-black/80 mt-1">
            Continuous Live Government Ingestion Pipeline (IMD, data.gov.in, NDMA) + PostgreSQL pgvector Hybrid Retrieval.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSyncIngestion}
            disabled={syncing}
            className="neo-btn neo-btn-primary text-xs font-black uppercase py-2.5 px-4 flex items-center gap-2"
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
            className="neo-btn neo-btn-accent text-xs font-black uppercase py-2.5 px-4 flex items-center gap-2"
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
      <div className="flex gap-3">
        <button
          onClick={() => setActiveSubTab('live')}
          className={`neo-btn text-xs font-black uppercase py-2 px-4 flex items-center gap-2 ${
            activeSubTab === 'live'
              ? 'bg-[#a3e635] text-black shadow-[4px_4px_0px_0px_#000000]'
              : 'bg-white text-black hover:bg-gray-100'
          }`}
        >
          <Sparkles className="w-4 h-4 stroke-[2.5]" /> Live Knowledge ({knowledgeRecords.length})
        </button>

        <button
          onClick={() => setActiveSubTab('static')}
          className={`neo-btn text-xs font-black uppercase py-2 px-4 flex items-center gap-2 ${
            activeSubTab === 'static'
              ? 'bg-[#38bdf8] text-black shadow-[4px_4px_0px_0px_#000000]'
              : 'bg-white text-black hover:bg-gray-100'
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
            <h3 className="text-xs font-black uppercase tracking-wider text-white mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#ffe600]" /> Open Datasets Catalog ({datasets.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {datasets.map((ds) => (
                <div key={ds.id} className="neo-box p-4 bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000000] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="neo-badge bg-[#a3e635] text-black text-[10px]">
                      {ds.source}
                    </span>
                    <span className="text-[10px] font-bold text-black flex items-center gap-1">
                      <Clock className="w-3 h-3 text-black" /> Live Synced
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-black leading-snug">{ds.name}</h4>
                  <p className="text-xs font-medium text-black/70 line-clamp-2">{ds.description}</p>
                  <div className="pt-2 flex items-center justify-between border-t-2 border-black text-xs font-bold text-black">
                    <span>Records: <strong className="text-[#581c87] text-sm">{ds.record_count}</strong></span>
                    {ds.is_mock && <span className="neo-badge bg-[#ffe600] text-black text-[9px]">DEMO REGISTRY</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ingested Knowledge Records Table */}
          <div className="neo-box bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000000] overflow-hidden">
            <div className="p-4 bg-[#a3e635] border-b-3 border-black flex items-center justify-between">
              <span className="font-black text-sm text-black uppercase tracking-wide flex items-center gap-2">
                <Shield className="w-5 h-5 text-black stroke-[2.5]" /> pgvector Knowledge Records ({knowledgeRecords.length})
              </span>
              <span className="neo-badge bg-white text-black text-xs font-bold">
                SHA-256 Deduplicated
              </span>
            </div>

            {knowledgeRecords.length === 0 ? (
              <div className="p-8 text-center text-black font-bold text-sm bg-white">
                No live knowledge records loaded yet. Click "Sync Feeds Now" above to trigger ingestion pipeline.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-black">
                  <thead className="bg-[#fef08a] border-b-3 border-black text-xs font-black uppercase tracking-wider">
                    <tr>
                      <th className="p-4 border-r-2 border-black">Source</th>
                      <th className="p-4 border-r-2 border-black">Title</th>
                      <th className="p-4 border-r-2 border-black">Version</th>
                      <th className="p-4 border-r-2 border-black">Freshness</th>
                      <th className="p-4">Valid From</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black font-medium">
                    {knowledgeRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#a3e635]/20 text-xs">
                        <td className="p-4 font-mono font-bold text-black border-r-2 border-black">{rec.source}</td>
                        <td className="p-4 font-bold text-black max-w-sm truncate border-r-2 border-black">{rec.title}</td>
                        <td className="p-4 border-r-2 border-black">
                          <span className="neo-badge bg-[#d8b4fe] text-black text-[10px]">
                            v{rec.version || 1}
                          </span>
                        </td>
                        <td className="p-4 border-r-2 border-black">
                          <span className="neo-badge bg-[#a3e635] text-black text-[10px] flex items-center gap-1 w-max">
                            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                            FRESH
                          </span>
                        </td>
                        <td className="p-4 text-black font-mono font-bold">{new Date(rec.valid_from).toLocaleTimeString()}</td>
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
            className="neo-box p-8 bg-[#38bdf8] border-3 border-black border-dashed shadow-[6px_6px_0px_0px_#000000] text-center space-y-3 cursor-pointer hover:bg-[#38bdf8]/90 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-white border-3 border-black flex items-center justify-center mx-auto text-black shadow-[3px_3px_0px_0px_#000000]">
              <Upload className="w-7 h-7 stroke-[3]" />
            </div>
            <div className="text-base font-black uppercase text-black">
              Click or Drag PDF / TXT files here to upload
            </div>
            <p className="text-xs font-bold text-black/80 max-w-md mx-auto">
              Files are broken into overlapping chunks, embedded with 1536-dim vectors, and indexed in PostgreSQL pgvector.
            </p>
          </div>

          {/* Indexed Documents Table */}
          <div className="neo-box bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000000] overflow-hidden">
            <div className="p-4 bg-[#38bdf8] border-b-3 border-black font-black text-sm text-black uppercase tracking-wide">
              Indexed Documents ({documents.length})
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center text-black font-bold text-sm bg-white">
                No static documents uploaded yet. Upload a PDF or TXT file above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-black">
                  <thead className="bg-[#fef08a] border-b-3 border-black text-xs font-black uppercase tracking-wider">
                    <tr>
                      <th className="p-4 border-r-2 border-black">Document Title</th>
                      <th className="p-4 border-r-2 border-black">Size</th>
                      <th className="p-4 border-r-2 border-black">Chunks</th>
                      <th className="p-4 border-r-2 border-black">Status</th>
                      <th className="p-4 border-r-2 border-black">Uploaded</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black font-medium">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[#38bdf8]/20 text-xs">
                        <td className="p-4 font-bold text-black flex items-center gap-2 border-r-2 border-black">
                          <FileText className="w-4 h-4 text-black stroke-[2.5]" />
                          {doc.title}
                        </td>
                        <td className="p-4 text-black font-mono font-bold border-r-2 border-black">{(doc.file_size / 1024).toFixed(1)} KB</td>
                        <td className="p-4 font-mono font-bold text-black border-r-2 border-black">{doc.chunk_count} chunks</td>
                        <td className="p-4 border-r-2 border-black">
                          <span className="neo-badge bg-[#a3e635] text-black text-[10px] flex items-center gap-1 w-max">
                            <CheckCircle className="w-3.5 h-3.5 stroke-[2.5]" /> {doc.status}
                          </span>
                        </td>
                        <td className="p-4 text-black font-mono font-bold border-r-2 border-black">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="neo-btn bg-[#ff6b5b] hover:bg-[#ff6b5b]/90 text-black p-1.5"
                          >
                            <Trash2 className="w-4 h-4 stroke-[2.5]" />
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
