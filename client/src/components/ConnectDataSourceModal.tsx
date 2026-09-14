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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto">
      <div className="bg-white border-2 border-[#1c1917] rounded-lg w-full max-w-2xl overflow-hidden shadow-bauhaus my-8 text-[#1c1917]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-[#1c1917] bg-[#e63946] text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white text-[#1c1917] border border-[#1c1917] flex items-center justify-center">
              <Database className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight uppercase font-display">Connect Data Source</h2>
              <p className="text-xs font-bold opacity-90">Add a custom REST/JSON API endpoint to Live Knowledge Layer</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 bg-[#1c1917] text-white rounded-full font-extrabold w-7 h-7 flex items-center justify-center hover:bg-[#2563eb] transition-all"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleAddDataSource} className="p-6 space-y-5 bg-[#f4f1ea]">
          {/* Name & URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider mb-2">
                Data Source Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Punjab Rainfall API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border-2 border-[#1c1917] rounded-lg text-xs font-bold text-[#1c1917] focus:outline-none focus:border-[#2563eb]"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider mb-2">
                Refresh Interval
              </label>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border-2 border-[#1c1917] rounded-lg text-xs font-bold text-[#1c1917] focus:outline-none focus:border-[#2563eb]"
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
            <label className="block text-xs font-extrabold uppercase tracking-wider mb-2">
              API Endpoint URL (REST / JSON) *
            </label>
            <input
              type="url"
              required
              placeholder="https://example.gov/api/v1/rainfall"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border-2 border-[#1c1917] rounded-lg text-xs font-mono font-bold text-[#1c1917] focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          {/* Authentication Config */}
          <div className="p-4 bg-white border-2 border-[#1c1917] rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 font-display">
                <Shield className="w-4 h-4 text-[#1c1917] stroke-[2.5]" /> Authentication
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAuthType('none')}
                className={`py-2 px-3 rounded-full text-xs font-extrabold uppercase border-2 border-[#1c1917] transition-all ${
                  authType === 'none'
                    ? 'bg-[#1c1917] text-white'
                    : 'bg-white text-[#1c1917] hover:bg-[#eae6df]'
                }`}
              >
                No Auth
              </button>
              <button
                type="button"
                onClick={() => setAuthType('api_key')}
                className={`py-2 px-3 rounded-full text-xs font-extrabold uppercase border-2 border-[#1c1917] transition-all ${
                  authType === 'api_key'
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-white text-[#1c1917] hover:bg-[#eae6df]'
                }`}
              >
                API Key
              </button>
              <button
                type="button"
                onClick={() => setAuthType('bearer')}
                className={`py-2 px-3 rounded-full text-xs font-extrabold uppercase border-2 border-[#1c1917] transition-all ${
                  authType === 'bearer'
                    ? 'bg-[#e63946] text-white'
                    : 'bg-white text-[#1c1917] hover:bg-[#eae6df]'
                }`}
              >
                Bearer Token
              </button>
            </div>

            {authType === 'api_key' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#1c1917] mb-1">Key Placement</label>
                    <select
                      value={apiKeyLocation}
                      onChange={(e) => setApiKeyLocation(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-[#1c1917] rounded-lg text-xs font-bold text-[#1c1917]"
                    >
                      <option value="header">HTTP Header</option>
                      <option value="query">URL Query Parameter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#1c1917] mb-1">
                      {apiKeyLocation === 'header' ? 'Header Name' : 'Parameter Name'}
                    </label>
                    <input
                      type="text"
                      value={apiKeyLocation === 'header' ? headerName : paramName}
                      onChange={(e) =>
                        apiKeyLocation === 'header' ? setHeaderName(e.target.value) : setParamName(e.target.value)
                      }
                      className="w-full px-3 py-2 bg-white border border-[#1c1917] rounded-lg text-xs text-[#1c1917] font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#1c1917] mb-1">API Key Value</label>
                  <input
                    type="password"
                    placeholder="Enter API Key secret..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#1c1917] rounded-lg text-xs text-[#1c1917] font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {authType === 'bearer' && (
              <div className="pt-2">
                <label className="block text-[10px] font-bold text-[#1c1917] mb-1">Bearer Token Secret</label>
                <input
                  type="password"
                  placeholder="Enter Bearer Token..."
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#1c1917] rounded-lg text-xs text-[#1c1917] font-mono font-bold"
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
              className="py-2 px-4 bauhaus-btn-secondary text-xs font-extrabold uppercase flex items-center gap-2"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" /> : <RefreshCw className="w-4 h-4 stroke-[2.5]" />}
              <span>Test Connection</span>
            </button>

            {testResult?.success && (
              <span className="bauhaus-badge bg-[#e63946] text-white flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" /> Connection Verified
              </span>
            )}
          </div>

          {/* Test Connection Output Preview */}
          {testResult && (
            <div
              className={`p-4 rounded-lg border-2 border-[#1c1917] ${
                testResult.success
                  ? 'bg-white'
                  : 'bg-[#e63946] text-white'
              }`}
            >
              {testResult.success ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#1c1917]">
                    <span className="font-extrabold flex items-center gap-1.5 font-display">
                      <CheckCircle2 className="w-4 h-4 text-[#e63946] stroke-[2.5]" /> Connection Successful
                    </span>
                    <span className="font-mono bg-[#fbbf24] text-black px-2 py-0.5 border border-[#1c1917] rounded-full text-[10px]">
                      Records: <strong>{testResult.recordCount}</strong>
                    </span>
                  </div>

                  {/* Detected Fields Schema Tag Cloud */}
                  {testResult.schema && testResult.schema.length > 0 && (
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider mb-1 text-[#1c1917]">
                        Detected Field Schema
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {testResult.schema.map((f) => (
                          <span
                            key={f.name}
                            className="bauhaus-badge bg-[#eae6df] text-[#1c1917] font-mono text-[9px]"
                          >
                            {f.name}: {f.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample Records Table */}
                  {testResult.preview && testResult.preview.length > 0 && (
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider mb-1 text-[#1c1917]">
                        Data Preview
                      </div>
                      <div className="overflow-x-auto max-h-36 border border-[#1c1917] rounded bg-[#f4f1ea]">
                        <table className="w-full text-[10px] text-left text-[#1c1917]">
                          <thead className="bg-[#1c1917] text-white uppercase font-mono sticky top-0">
                            <tr>
                              {Object.keys(testResult.preview[0] || {}).slice(0, 5).map((col) => (
                                <th key={col} className="px-3 py-1">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y border-[#1c1917] font-mono font-bold">
                            {testResult.preview.map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#eae6df]">
                                {Object.keys(testResult.preview![0] || {}).slice(0, 5).map((col) => (
                                  <td key={col} className="px-3 py-1 truncate max-w-[120px]">
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
                <div className="flex items-start gap-2.5 text-white text-xs font-bold">
                  <AlertCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5 stroke-[2.5]" />
                  <div>
                    <strong className="font-extrabold uppercase block mb-0.5 font-display">Connection Failed</strong>
                    <p className="font-mono text-[10px] bg-[#1c1917] p-2 rounded">{testResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-lg bg-[#e63946] text-white font-bold text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 stroke-[2.5] flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#1c1917]">
            <button
              type="button"
              onClick={handleClose}
              className="py-2 px-4 text-xs font-extrabold uppercase text-[#1c1917] hover:bg-[#eae6df] rounded-full transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim() || !url.trim()}
              className="py-2.5 px-6 bauhaus-btn-accent text-xs font-extrabold uppercase flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />}
              <span>Add Data Source</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
