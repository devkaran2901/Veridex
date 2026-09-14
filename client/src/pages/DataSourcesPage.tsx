import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  Power,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  Loader2,
  Eye,
  Server,
  Layers
} from 'lucide-react';
import { ConnectDataSourceModal } from '../components/ConnectDataSourceModal';

interface DataSource {
  id: string;
  name: string;
  url: string;
  domain: string;
  auth_type: 'none' | 'api_key' | 'bearer';
  refresh_interval: number;
  status: 'HEALTHY' | 'DEGRADED' | 'ERROR' | 'DISABLED';
  last_fetched_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  schema: any[];
  record_count: number;
  is_active: boolean;
  created_at: string;
}

export const DataSourcesPage: React.FC = () => {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ id: string; text: string } | null>(null);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data-sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      } else {
        setError('Failed to load data sources');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async (id: string) => {
    setSyncingId(id);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/data-sources/${id}/sync`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const s = data.stats;
        if (s) {
          setSyncMessage({
            id,
            text: `Sync complete — Fetched: ${s.fetched}, New: ${s.new}, Updated: ${s.updated}, Unchanged: ${s.unchanged}, Errors: ${s.errors}`,
          });
        }
        await fetchDataSources();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncingId(null);
    }
  };

  const handleToggleEnable = async (source: DataSource) => {
    const endpoint = source.status === 'DISABLED' ? 'enable' : 'disable';
    try {
      await fetch(`/api/data-sources/${source.id}/${endpoint}`, { method: 'POST' });
      await fetchDataSources();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this data source and its ingested records?')) return;
    try {
      await fetch(`/api/data-sources/${id}`, { method: 'DELETE' });
      await fetchDataSources();
    } catch (err) {
      console.error(err);
    }
  };

  const totalRecords = sources.reduce((acc, s) => acc + (s.record_count || 0), 0);
  const healthyCount = sources.filter((s) => s.status === 'HEALTHY').length;

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-[#e9d5ff]/30 text-black font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-[#ffe600] border-4 border-black shadow-[6px_6px_0px_0px_#000] rounded-2xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#ff6b5b] border-3 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center">
            <Server className="w-8 h-8 text-black stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-black tracking-wider uppercase flex items-center gap-2">
              Connected Data Sources
            </h1>
            <p className="text-xs font-bold text-black mt-1">
              Connect REST/JSON APIs directly into Veridex's Live Knowledge Layer for Real-Time RAG
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="py-3 px-5 neo-btn text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>Connect Data Source</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center justify-between text-black mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Total APIs Connected</span>
            <Database className="w-5 h-5 stroke-[2.5] text-black" />
          </div>
          <div className="text-3xl font-black text-black">{sources.length}</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#ccff00] border-3 border-black shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center justify-between text-black mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Healthy Status</span>
            <CheckCircle2 className="w-5 h-5 stroke-[2.5] text-black" />
          </div>
          <div className="text-3xl font-black text-black">
            {healthyCount} <span className="text-xs font-bold uppercase text-black">/ {sources.length} active</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#38bdf8] border-3 border-black shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center justify-between text-black mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Ingested Records</span>
            <Layers className="w-5 h-5 stroke-[2.5] text-black" />
          </div>
          <div className="text-3xl font-black text-black">{totalRecords.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#d8b4fe] border-3 border-black shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center justify-between text-black mb-2">
            <span className="text-xs font-black uppercase tracking-wider">Sync Worker</span>
            <Clock className="w-5 h-5 stroke-[2.5] text-black" />
          </div>
          <div className="text-3xl font-black text-black">Continuous</div>
        </div>
      </div>

      {/* Main Grid / Data Source Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="w-10 h-10 text-black animate-spin stroke-[2.5]" />
          <p className="text-xs font-black uppercase text-black">Loading connected data sources...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-black bg-[#ff6b5b] border-3 border-black shadow-[4px_4px_0px_0px_#000] rounded-2xl">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 stroke-[2.5]" />
          <p className="text-sm font-black uppercase">{error}</p>
        </div>
      ) : sources.length === 0 ? (
        <div className="p-12 text-center border-4 border-dashed border-black rounded-2xl bg-white shadow-[4px_4px_0px_0px_#000] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#ffe600] border-3 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center mx-auto text-black">
            <Globe className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-lg font-black text-black uppercase">No Custom Data Sources Connected</h3>
            <p className="text-xs font-bold text-black max-w-md mx-auto mt-1">
              Connect your organization's REST/JSON APIs to ingest live records directly into PostgreSQL pgvector for Agentic RAG.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="py-3 px-5 neo-btn text-black text-xs font-black uppercase inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span>Connect First API</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sources.map((source) => {
            const isSyncing = syncingId === source.id;
            const isHealthy = source.status === 'HEALTHY';
            const isError = source.status === 'ERROR';
            const isDisabled = source.status === 'DISABLED';

            return (
              <div
                key={source.id}
                className="bg-white border-3 border-black shadow-[5px_5px_0px_0px_#000] rounded-2xl p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[7px_7px_0px_0px_#000] transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Status Badge & Actions */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`neo-badge ${
                        isHealthy
                          ? 'bg-[#ccff00] text-black'
                          : isError
                          ? 'bg-[#ff6b5b] text-black'
                          : 'bg-gray-200 text-black'
                      }`}
                    >
                      {source.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedSource(source)}
                        title="View Details"
                        className="p-1.5 bg-white border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-[#ffe600] transition-all"
                      >
                        <Eye className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <button
                        onClick={() => handleToggleEnable(source)}
                        title={isDisabled ? 'Enable Sync' : 'Disable Sync'}
                        className={`p-1.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] transition-all ${
                          isDisabled ? 'bg-[#ccff00]' : 'bg-[#ffe600] hover:bg-[#ff6b5b]'
                        }`}
                      >
                        <Power className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        title="Delete Data Source"
                        className="p-1.5 bg-[#ff6b5b] border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] hover:bg-rose-500 transition-all text-black"
                      >
                        <Trash2 className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Domain */}
                  <h3 className="font-black text-black text-lg uppercase tracking-tight line-clamp-1">{source.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-black font-mono font-bold mt-1">
                    <Globe className="w-4 h-4 flex-shrink-0 text-black stroke-[2.5]" />
                    <span className="truncate">{source.domain || source.url}</span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-[#e9d5ff]/40 rounded-xl border-2 border-black text-xs font-bold">
                    <div>
                      <span className="text-black text-[10px] uppercase font-black block">Record Count</span>
                      <span className="font-black text-black font-mono text-sm">{source.record_count?.toLocaleString() || 0}</span>
                    </div>
                    <div>
                      <span className="text-black text-[10px] uppercase font-black block">Refresh Interval</span>
                      <span className="font-bold text-black font-mono">Every {source.refresh_interval}m</span>
                    </div>
                    <div>
                      <span className="text-black text-[10px] uppercase font-black block">Authentication</span>
                      <span className="font-bold text-black uppercase">{source.auth_type}</span>
                    </div>
                    <div>
                      <span className="text-black text-[10px] uppercase font-black block">Last Synced</span>
                      <span className="font-bold text-black font-mono">
                        {source.last_fetched_at ? new Date(source.last_fetched_at).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Error banner if present */}
                  {source.last_error && (
                    <div className="p-3 rounded-xl bg-[#ff6b5b] border-2 border-black text-xs text-black font-bold flex items-start gap-2 shadow-[2px_2px_0px_0px_#000]">
                      <AlertCircle className="w-4 h-4 text-black flex-shrink-0 mt-0.5 stroke-[2.5]" />
                      <span className="line-clamp-2">{source.last_error}</span>
                    </div>
                  )}

                  {/* Sync success stats banner */}
                  {syncMessage && syncMessage.id === source.id && (
                    <div className="p-3 rounded-xl bg-[#ccff00] border-2 border-black text-xs text-black font-bold flex items-start gap-2 shadow-[2px_2px_0px_0px_#000] mt-2">
                      <CheckCircle2 className="w-4 h-4 text-black flex-shrink-0 mt-0.5 stroke-[2.5]" />
                      <span>{syncMessage.text}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="pt-2">
                  <button
                    onClick={() => handleSyncNow(source.id)}
                    disabled={isSyncing || isDisabled}
                    className="w-full py-2.5 px-3 neo-btn text-xs font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black stroke-[3]" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-black stroke-[3]" />
                    )}
                    <span>{isSyncing ? 'Syncing Records...' : 'Sync Now'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Data Source Modal */}
      <ConnectDataSourceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchDataSources}
      />

      {/* Source Detail Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] rounded-2xl w-full max-w-xl p-6 space-y-4 text-xs text-black font-bold">
            <div className="flex items-center justify-between border-b-3 border-black pb-3">
              <h3 className="text-base font-black text-black uppercase tracking-wide">{selectedSource.name} Details</h3>
              <button onClick={() => setSelectedSource(null)} className="p-1 rounded-lg bg-[#ff6b5b] border-2 border-black font-black">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-black block text-[10px] uppercase font-black">API Endpoint URL:</span>
                <span className="font-mono text-xs bg-[#e9d5ff] p-2 border-2 border-black rounded-lg block break-all font-bold">{selectedSource.url}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-black block text-[10px] uppercase font-black">Status:</span>
                  <span className="neo-badge bg-[#ccff00] text-black inline-block">{selectedSource.status}</span>
                </div>
                <div>
                  <span className="text-black block text-[10px] uppercase font-black">Authentication:</span>
                  <span className="neo-badge bg-[#ffe600] text-black inline-block">{selectedSource.auth_type}</span>
                </div>
              </div>
              <div>
                <span className="text-black block text-[10px] uppercase font-black mb-1.5">Detected Field Schema:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedSource.schema || []).map((s: any, idx) => (
                    <span key={idx} className="neo-badge bg-[#38bdf8] text-black font-mono">
                      {typeof s === 'string' ? s : `${s.name}: ${s.type}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
