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
    <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-[#f4f1ea] text-[#1c1917] font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border-2 border-[#1c1917] shadow-bauhaus rounded-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#e63946] text-white border-2 border-[#1c1917] flex items-center justify-center">
            <Server className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#1c1917] tracking-tight uppercase font-display flex items-center gap-2">
              Connected Data Sources
            </h1>
            <p className="text-xs font-bold text-[#1c1917]/70 mt-0.5">
              Connect REST/JSON APIs directly into Veridex's Live Knowledge Layer for Real-Time RAG
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="py-2.5 px-5 bauhaus-btn-accent text-white text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Connect Data Source</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-white border-2 border-[#1c1917] shadow-sm">
          <div className="flex items-center justify-between text-[#1c1917] mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total APIs Connected</span>
            <Database className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="text-2xl font-extrabold font-display">{sources.length}</div>
        </div>

        <div className="p-4 rounded-lg bg-[#e63946] text-white border-2 border-[#1c1917] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Healthy Status</span>
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="text-2xl font-extrabold font-display">
            {healthyCount} <span className="text-xs font-bold uppercase opacity-80">/ {sources.length} active</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#2563eb] text-white border-2 border-[#1c1917] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Ingested Records</span>
            <Layers className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="text-2xl font-extrabold font-display">{totalRecords.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-lg bg-[#fbbf24] text-[#1c1917] border-2 border-[#1c1917] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Sync Worker</span>
            <Clock className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="text-2xl font-extrabold font-display">Continuous</div>
        </div>
      </div>

      {/* Main Grid / Data Source Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="w-8 h-8 text-[#1c1917] animate-spin stroke-[2.5]" />
          <p className="text-xs font-extrabold uppercase text-[#1c1917]">Loading connected data sources...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-white bg-[#e63946] border-2 border-[#1c1917] rounded-lg">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 stroke-[2.5]" />
          <p className="text-sm font-extrabold uppercase">{error}</p>
        </div>
      ) : sources.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-[#1c1917] rounded-lg bg-white shadow-bauhaus space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#fbbf24] border-2 border-[#1c1917] flex items-center justify-center mx-auto text-[#1c1917]">
            <Globe className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1c1917] uppercase font-display">No Custom Data Sources Connected</h3>
            <p className="text-xs font-bold text-[#1c1917]/70 max-w-md mx-auto mt-1">
              Connect your organization's REST/JSON APIs to ingest live records directly into PostgreSQL pgvector for Agentic RAG.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="py-2.5 px-5 bauhaus-btn-accent text-white text-xs font-extrabold uppercase inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
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
                className="bg-white border-2 border-[#1c1917] shadow-bauhaus rounded-lg p-5 flex flex-col justify-between space-y-4 hover:translate-y-[-1px] transition-all"
              >
                <div>
                  {/* Status Badge & Actions */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`bauhaus-badge ${
                        isHealthy
                          ? 'bg-[#e63946] text-white'
                          : isError
                          ? 'bg-[#fbbf24] text-black'
                          : 'bg-gray-200 text-black'
                      }`}
                    >
                      {source.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedSource(source)}
                        title="View Details"
                        className="p-1.5 bg-white border border-[#1c1917] rounded-full hover:bg-[#fbbf24] transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        onClick={() => handleToggleEnable(source)}
                        title={isDisabled ? 'Enable Sync' : 'Disable Sync'}
                        className={`p-1.5 border border-[#1c1917] rounded-full transition-all ${
                          isDisabled ? 'bg-[#e63946] text-white' : 'bg-[#2563eb] text-white hover:bg-[#1c1917]'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        title="Delete Data Source"
                        className="p-1.5 bg-[#e63946] text-white border border-[#1c1917] rounded-full hover:bg-black transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Domain */}
                  <h3 className="font-extrabold text-[#1c1917] text-base uppercase tracking-tight line-clamp-1 font-display">{source.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#1c1917]/70 font-mono font-bold mt-1">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0 stroke-[2.5]" />
                    <span className="truncate">{source.domain || source.url}</span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-[#eae6df] rounded-lg border border-[#1c1917] text-xs font-bold">
                    <div>
                      <span className="text-[#1c1917] text-[9px] uppercase font-extrabold block">Record Count</span>
                      <span className="font-extrabold text-[#1c1917] font-mono text-xs">{source.record_count?.toLocaleString() || 0}</span>
                    </div>
                    <div>
                      <span className="text-[#1c1917] text-[9px] uppercase font-extrabold block">Refresh Interval</span>
                      <span className="font-bold text-[#1c1917] font-mono">Every {source.refresh_interval}m</span>
                    </div>
                    <div>
                      <span className="text-[#1c1917] text-[9px] uppercase font-extrabold block">Authentication</span>
                      <span className="font-bold text-[#1c1917] uppercase">{source.auth_type}</span>
                    </div>
                    <div>
                      <span className="text-[#1c1917] text-[9px] uppercase font-extrabold block">Last Synced</span>
                      <span className="font-bold text-[#1c1917] font-mono">
                        {source.last_fetched_at ? new Date(source.last_fetched_at).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Error banner if present */}
                  {source.last_error && (
                    <div className="p-3 rounded-lg bg-[#e63946] text-white border border-[#1c1917] text-xs font-bold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 stroke-[2.5]" />
                      <span className="line-clamp-2">{source.last_error}</span>
                    </div>
                  )}

                  {/* Sync success stats banner */}
                  {syncMessage && syncMessage.id === source.id && (
                    <div className="p-3 rounded-lg bg-[#fbbf24] text-black border border-[#1c1917] text-xs font-bold flex items-start gap-2 mt-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 stroke-[2.5]" />
                      <span>{syncMessage.text}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="pt-2">
                  <button
                    onClick={() => handleSyncNow(source.id)}
                    disabled={isSyncing || isDisabled}
                    className="w-full py-2 px-3 bauhaus-btn text-xs font-extrabold uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                    ) : (
                      <RefreshCw className="w-4 h-4 stroke-[2.5]" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-white border-2 border-[#1c1917] shadow-bauhaus rounded-lg w-full max-w-xl p-6 space-y-4 text-xs text-[#1c1917] font-bold">
            <div className="flex items-center justify-between border-b-2 border-[#1c1917] pb-3">
              <h3 className="text-base font-extrabold text-[#1c1917] uppercase tracking-wide font-display">{selectedSource.name} Details</h3>
              <button onClick={() => setSelectedSource(null)} className="p-1 rounded-full bg-[#e63946] text-white border border-[#1c1917] font-extrabold w-6 h-6 flex items-center justify-center">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-[#1c1917] block text-[10px] uppercase font-extrabold">API Endpoint URL:</span>
                <span className="font-mono text-xs bg-[#eae6df] p-2 border border-[#1c1917] rounded block break-all font-bold">{selectedSource.url}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[#1c1917] block text-[10px] uppercase font-extrabold">Status:</span>
                  <span className="bauhaus-badge bg-[#e63946] text-white inline-block">{selectedSource.status}</span>
                </div>
                <div>
                  <span className="text-[#1c1917] block text-[10px] uppercase font-extrabold">Authentication:</span>
                  <span className="bauhaus-badge bg-[#2563eb] text-white inline-block">{selectedSource.auth_type}</span>
                </div>
              </div>
              <div>
                <span className="text-[#1c1917] block text-[10px] uppercase font-extrabold mb-1.5">Detected Field Schema:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedSource.schema || []).map((s: any, idx) => (
                    <span key={idx} className="bauhaus-badge bg-[#fbbf24] text-black font-mono">
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
