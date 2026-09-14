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
    <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
      {/* Header Banner */}
      <div className="neo-box p-6 bg-[#38bdf8] border-3 border-black shadow-[6px_6px_0px_0px_#000000]">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black flex items-center gap-2">
          <Activity className="w-7 h-7 text-black stroke-[3]" /> Agent Execution Runs Log
        </h2>
        <p className="text-xs font-bold text-black/80 mt-1">
          Historical log of all LangGraph agent runs, selected tools, latencies, and execution traces.
        </p>
      </div>

      <div className="neo-box bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000000] overflow-hidden">
        {runs.length === 0 ? (
          <div className="p-12 text-center text-black space-y-3">
            <Activity className="w-12 h-12 mx-auto text-black stroke-[2.5]" />
            <p className="font-black text-lg uppercase text-black">No agent runs recorded yet.</p>
            <p className="text-xs font-bold text-black/70">
              Every query processed by the agent will store a complete audit trail here!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-black">
              <thead className="bg-[#ffe600] border-b-3 border-black text-xs font-black uppercase tracking-wider">
                <tr>
                  <th className="p-4 border-r-2 border-black">User Query</th>
                  <th className="p-4 border-r-2 border-black">Tools Selected</th>
                  <th className="p-4 border-r-2 border-black">Latency</th>
                  <th className="p-4 border-r-2 border-black">Status</th>
                  <th className="p-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black font-medium">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-[#38bdf8]/20">
                    <td className="p-4 font-bold text-black max-w-xs truncate border-r-2 border-black">{run.query}</td>
                    <td className="p-4 border-r-2 border-black">
                      <div className="flex flex-wrap gap-1">
                        {run.selected_tools?.map((tool, idx) => (
                          <span key={idx} className="neo-badge bg-[#d8b4fe] text-black text-[10px] font-mono">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 font-mono font-black text-xs text-black border-r-2 border-black">{run.response_latency_ms}ms</td>
                    <td className="p-4 border-r-2 border-black">
                      <span className="neo-badge bg-[#a3e635] text-black text-xs flex items-center gap-1 w-max">
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" /> Completed
                      </span>
                    </td>
                    <td className="p-4 text-xs font-mono font-bold text-black">{new Date(run.created_at).toLocaleTimeString()}</td>
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
