import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Database, Shield, RefreshCw } from 'lucide-react';

interface SchemaField {
  name: string;
  type: string;
  nullable: boolean;
  sampleValue?: any;
}

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  recordCount?: number;
  dataPath?: string;
  schema?: SchemaField[];
  preview?: Record<string, any>[];
}

interface ConnectDataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ConnectDataSourceModal: React.FC<ConnectDataSourceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState<'none' | 'api_key' | 'bearer'>('none');
  const [apiKeyLocation, setApiKeyLocation] = useState<'header' | 'query'>('header');
  const [headerName, setHeaderName] = useState('X-API-Key');
  const [paramName, setParamName] = useState('api_key');
  const [apiKey, setApiKey] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [refreshInterval, setRefreshInterval] = useState('10');

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleClose = () => {
    setName('');
    setUrl('');
    setApiKey('');
    setBearerToken('');
    setTestResult(null);
    setSaveError(null);
    onClose();
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!url.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setSaveError(null);

    try {
      const res = await fetch('/api/data-sources/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          authType,
          apiKey,
          apiKeyLocation,
          headerName,
          paramName,
          bearerToken,
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.error) {
        if (res.status === 401) data.error = 'HTTP 401: Unauthorized. The API rejected the provided credentials.';
        else if (res.status === 403) data.error = 'HTTP 403: Forbidden. Access to this API endpoint was denied.';
        else if (res.status === 404) data.error = 'HTTP 404: Endpoint not found. Please verify the URL.';
        else if (res.status === 429) data.error = 'HTTP 429: Rate limited by target API provider.';
        else data.error = `HTTP ${res.status}: ${res.statusText}`;
      }
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Failed to connect to backend service',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddDataSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          authType,
          apiKeyLocation,
          headerName,
          paramName,
          apiKey,
          bearerToken,
          refreshInterval: parseInt(refreshInterval, 10),
        }),
      });

      if (res.ok) {
        handleClose();
        onSuccess();
      } else {
        const errData = await res.json();
        setSaveError(errData.error || 'Failed to save data source');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Network error while adding data source');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0f172a] border border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Connect Data Source</h2>
              <p className="text-xs text-gray-400">Add a custom REST/JSON API endpoint to Live Knowledge Layer</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleAddDataSource} className="p-6 space-y-5">
          {/* Name & URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Data Source Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Punjab Rainfall API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-900/80 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Refresh Interval
              </label>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-900/80 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
              >
                <option value="5">Every 5 minutes</option>
                <option value="10">Every 10 minutes</option>
                <option value="30">Every 30 minutes</option>
                <option value="60">Every 1 hour</option>
                <option value="360">Every 6 hours</option>
                <option value="1440">Every 24 hours</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              API Endpoint URL (REST / JSON) *
            </label>
            <input
              type="url"
              required
              placeholder="https://example.gov/api/v1/rainfall"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-900/80 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-mono text-xs"
            />
          </div>

          {/* Authentication Config */}
          <div className="p-4 bg-gray-900/40 border border-gray-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-indigo-400" /> Authentication
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAuthType('none')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  authType === 'none'
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                    : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                }`}
              >
                No Auth
              </button>
              <button
                type="button"
                onClick={() => setAuthType('api_key')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  authType === 'api_key'
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                    : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                }`}
              >
                API Key
              </button>
              <button
                type="button"
                onClick={() => setAuthType('bearer')}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                  authType === 'bearer'
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                    : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200'
                }`}
              >
                Bearer Token
              </button>
            </div>

            {authType === 'api_key' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Key Placement</label>
                    <select
                      value={apiKeyLocation}
                      onChange={(e) => setApiKeyLocation(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white"
                    >
                      <option value="header">HTTP Header</option>
                      <option value="query">URL Query Parameter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      {apiKeyLocation === 'header' ? 'Header Name' : 'Parameter Name'}
                    </label>
                    <input
                      type="text"
                      value={apiKeyLocation === 'header' ? headerName : paramName}
                      onChange={(e) =>
                        apiKeyLocation === 'header' ? setHeaderName(e.target.value) : setParamName(e.target.value)
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">API Key Value</label>
                  <input
                    type="password"
                    placeholder="Enter API Key secret..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}

            {authType === 'bearer' && (
              <div className="pt-2">
                <label className="block text-[11px] text-gray-400 mb-1">Bearer Token Secret</label>
                <input
                  type="password"
                  placeholder="Enter Bearer Token..."
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
            )}
          </div>

          {/* Test Connection Button */}
          <div className="flex justify-between items-center pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !url.trim()}
              className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-semibold rounded-xl flex items-center gap-2 border border-gray-700 transition-all"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <RefreshCw className="w-4 h-4 text-indigo-400" />}
              <span>Test Connection</span>
            </button>

            {testResult?.success && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Connection Verified
              </span>
            )}
          </div>

          {/* Test Connection Output Preview */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border ${
                testResult.success
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-rose-950/20 border-rose-500/30'
              }`}
            >
              {testResult.success ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Connection Successful
                    </span>
                    <span className="text-gray-300 font-mono">
                      Records Detected: <strong>{testResult.recordCount}</strong> (Path: `{testResult.dataPath}`)
                    </span>
                  </div>

                  {/* Detected Fields Schema Tag Cloud */}
                  {testResult.schema && testResult.schema.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                        Detected Field Schema
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {testResult.schema.map((f) => (
                          <span
                            key={f.name}
                            className="px-2 py-0.5 bg-gray-900 border border-gray-700/60 rounded text-[11px] text-indigo-300 font-mono"
                          >
                            {f.name}: <span className="text-gray-400">{f.type}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample Records Table */}
                  {testResult.preview && testResult.preview.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                        Data Preview (First {testResult.preview.length} records)
                      </div>
                      <div className="overflow-x-auto max-h-40 border border-gray-800 rounded-lg">
                        <table className="w-full text-[11px] text-left text-gray-300">
                          <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] font-mono sticky top-0">
                            <tr>
                              {Object.keys(testResult.preview[0] || {}).slice(0, 5).map((col) => (
                                <th key={col} className="px-3 py-1.5">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800 font-mono">
                            {testResult.preview.map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-800/40">
                                {Object.keys(testResult.preview![0] || {}).slice(0, 5).map((col) => (
                                  <td key={col} className="px-3 py-1.5 truncate max-w-[120px]">
                                    {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2.5 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block mb-0.5">Connection Failed</strong>
                    <p className="text-gray-300 font-mono text-[11px]">{testResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={handleClose}
              className="py-2.5 px-4 text-xs font-semibold text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim() || !url.trim()}
              className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-98"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Add Data Source</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
