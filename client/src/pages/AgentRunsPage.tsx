import React, { useEffect, useState } from 'react';
import { Activity, Clock, Zap, CheckCircle2, ChevronRight } from 'lucide-react';

interface AgentRunItem {
  id: string;
  query: string;
  status: string;
  selected_tools: string[];
  response_latency_ms: number;
  created_at: string;
}

export const AgentRunsPage: React.FC = () => {
  const [runs, setRuns] = useState<AgentRunItem[]>([]);

  useEffect(() => {
    fetchAgentRuns();
  }, []);

  const fetchAgentRuns = async () => {
    try {
      const res = await fetch('/api/agent-runs');
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#0b0f19]/60 space-y-6">
      <div className="border-b border-gray-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-400" /> Agent Execution Runs Log
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Historical log of all LangGraph agent runs, selected tools, latencies, and execution traces.
        </p>
      </div>

      <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden">
        {runs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-2">
            <Activity className="w-8 h-8 mx-auto text-indigo-400/40" />
            <p className="font-medium text-gray-300">No agent runs recorded yet.</p>
            <p className="text-xs">
              Every query processed by the agent will store a complete audit trail here!
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/80 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="p-4">User Query</th>
                <th className="p-4">Tools Selected</th>
                <th className="p-4">Latency</th>
                <th className="p-4">Status</th>
                <th className="p-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-800/30 cursor-pointer">
                  <td className="p-4 font-medium text-white max-w-xs truncate">{run.query}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {run.selected_tools?.map((tool, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs text-emerald-400">{run.response_latency_ms}ms</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 flex items-center gap-1 w-max">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-400">{new Date(run.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
