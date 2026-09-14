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
  Shield,
  Eye,
  Server,
  Layers,
  ChevronRight
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
    <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-[#0b0f19] text-gray-100">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-panel rounded-2xl border border-gray-800 bg-gradient-to-r from-gray-900/90 via-indigo-950/30 to-gray-900/90">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              Connected Data Sources
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Connect REST/JSON APIs directly into Veridex's Live Knowledge Layer for Real-Time RAG
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/40 transition-all active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Data Source</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl glass-panel border border-gray-800 bg-gray-900/40">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total APIs Connected</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{sources.length}</div>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-gray-800 bg-gray-900/40">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Healthy Status</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {healthyCount} <span className="text-xs text-gray-400 font-normal">/ {sources.length} active</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-gray-800 bg-gray-900/40">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ingested Records</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{totalRecords.toLocaleString()}</div>
        </div>

        <div className="p-4 rounded-xl glass-panel border border-gray-800 bg-gray-900/40">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Sync Worker</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-400">Continuous</div>
        </div>
      </div>

      {/* Main Grid / Data Source Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-xs text-gray-400">Loading connected data sources...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-rose-400 bg-rose-950/20 border border-rose-500/30 rounded-xl">
          <AlertCircle className="w-6 h-6 mx-auto mb-2" />
          <p className="text-sm">{error}</p>
        </div>
      ) : sources.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-gray-800 rounded-2xl bg-gray-900/20 space-y-4">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto text-gray-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">No Data Sources Connected</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
              Connect your organization's REST/JSON APIs to ingest live records directly into PostgreSQL pgvector for Agentic RAG.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Connect First API</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sources.map((source) => {
            const isSyncing = syncingId === source.id;
            const isHealthy = source.status === 'HEALTHY';
            const isError = source.status === 'ERROR';
            const isDisabled = source.status === 'DISABLED';

            return (
              <div
                key={source.id}
                className="glass-panel border border-gray-800/80 rounded-2xl p-5 hover:border-gray-700 transition-all flex flex-col justify-between space-y-4 bg-gray-900/40 relative overflow-hidden"
              >
                <div>
                  {/* Status Badge & Actions */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase border ${
                        isHealthy
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : isError
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isHealthy ? 'bg-emerald-400 animate-pulse' : isError ? 'bg-rose-400' : 'bg-gray-400'
                        }`}
                      />
                      {source.status}
                    </span>

                    <div className="flex items-center gap-1 text-gray-400">
                      <button
                        onClick={() => setSelectedSource(source)}
                        title="View Details"
                        className="p-1.5 hover:text-white rounded-lg hover:bg-gray-800 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleEnable(source)}
                        title={isDisabled ? 'Enable Sync' : 'Disable Sync'}
                        className={`p-1.5 rounded-lg hover:bg-gray-800 transition-all ${
                          isDisabled ? 'text-emerald-400' : 'text-gray-400 hover:text-amber-400'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        title="Delete Data Source"
                        className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-gray-800 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Domain */}
                  <h3 className="font-bold text-white text-base tracking-wide line-clamp-1">{source.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono mt-1">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400/70" />
                    <span className="truncate">{source.domain || source.url}</span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-gray-950/60 rounded-xl border border-gray-800/60 text-xs">
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase font-semibold block">Record Count</span>
                      <span className="font-bold text-white font-mono">{source.record_count?.toLocaleString() || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase font-semibold block">Refresh Interval</span>
                      <span className="font-semibold text-gray-300 font-mono">Every {source.refresh_interval}m</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase font-semibold block">Authentication</span>
                      <span className="font-semibold text-gray-300 capitalize">{source.auth_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase font-semibold block">Last Synced</span>
                      <span className="font-semibold text-gray-300 font-mono">
                        {source.last_fetched_at ? new Date(source.last_fetched_at).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  {/* Error banner if present */}
                  {source.last_error && (
                    <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/20 text-[11px] text-rose-300 flex items-start gap-1.5 font-mono">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{source.last_error}</span>
                    </div>
                  )}

                  {/* Sync success stats banner */}
                  {syncMessage && syncMessage.id === source.id && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-start gap-1.5 font-mono mt-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{syncMessage.text}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="pt-2">
                  <button
                    onClick={() => handleSyncNow(source.id)}
                    disabled={isSyncing || isDisabled}
                    className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-xs font-semibold text-white rounded-xl flex items-center justify-center gap-2 border border-gray-700 transition-all active:scale-98"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
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
          <div className="bg-[#0f172a] border border-gray-800 rounded-2xl w-full max-w-xl p-6 space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-white font-sans">{selectedSource.name} Details</h3>
              <button onClick={() => setSelectedSource(null)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="space-y-2 text-gray-300">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase">API Endpoint URL:</span>
                <span className="text-indigo-400 break-all">{selectedSource.url}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Status:</span>
                  <span className="text-emerald-400 font-semibold">{selectedSource.status}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Authentication:</span>
                  <span className="text-white">{selectedSource.auth_type}</span>
                </div>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase mb-1">Detected Schema:</span>
                <div className="flex flex-wrap gap-1">
                  {(selectedSource.schema || []).map((s: any, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-900 border border-gray-800 rounded text-indigo-300">
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
