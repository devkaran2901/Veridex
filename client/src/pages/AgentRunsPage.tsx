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
    <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 bg-[#f4f1ea] text-[#1c1917]">
      {/* Header Banner */}
      <div className="bauhaus-card p-6 bg-[#2563eb] text-white border-2 border-[#1c1917] shadow-bauhaus">
        <h2 className="text-xl font-extrabold uppercase tracking-tight text-white flex items-center gap-2 font-display">
          <Activity className="w-6 h-6 text-white stroke-[2.5]" /> Agent Execution Runs Log
        </h2>
        <p className="text-xs font-bold opacity-80 mt-1">
          Historical log of all LangGraph agent runs, selected tools, latencies, and execution traces.
        </p>
      </div>

      <div className="bauhaus-card bg-white border-2 border-[#1c1917] shadow-bauhaus overflow-hidden">
        {runs.length === 0 ? (
          <div className="p-12 text-center text-[#1c1917] space-y-3">
            <Activity className="w-10 h-10 mx-auto text-[#1c1917] stroke-[2.5]" />
            <p className="font-extrabold text-base uppercase text-[#1c1917] font-display">No agent runs recorded yet.</p>
            <p className="text-xs font-bold text-[#1c1917]/70">
              Every query processed by the agent will store a complete audit trail here!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1c1917]">
              <thead className="bg-[#1c1917] text-white border-b-2 border-[#1c1917] text-[10px] font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-r border-gray-700">User Query</th>
                  <th className="p-3 border-r border-gray-700">Tools Selected</th>
                  <th className="p-3 border-r border-gray-700">Latency</th>
                  <th className="p-3 border-r border-gray-700">Status</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y border-[#1c1917] font-medium">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-[#eae6df]">
                    <td className="p-3 font-bold text-[#1c1917] max-w-xs truncate border-r border-[#1c1917]">{run.query}</td>
                    <td className="p-3 border-r border-[#1c1917]">
                      <div className="flex flex-wrap gap-1">
                        {run.selected_tools?.map((tool, idx) => (
                          <span key={idx} className="bauhaus-badge bg-[#2563eb] text-white text-[9px] font-mono">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 font-mono font-extrabold text-xs text-[#1c1917] border-r border-[#1c1917]">{run.response_latency_ms}ms</td>
                    <td className="p-3 border-r border-[#1c1917]">
                      <span className="bauhaus-badge bg-[#e63946] text-white text-[9px] flex items-center gap-1 w-max">
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" /> Completed
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono font-bold text-[#1c1917]">{new Date(run.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
