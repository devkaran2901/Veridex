import React, { useState } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  CloudSun, 
  Database, 
  Brain, 
  Zap,
  BookOpen,
  Shield,
  AlertTriangle
} from 'lucide-react';

export interface TraceStep {
  id: string;
  stepName: string;
  toolName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: any;
  output?: any;
  latencyMs?: number;
  timestamp: string;
}

interface AgentTracePanelProps {
  traceSteps: TraceStep[];
  isThinking: boolean;
  selectedSources?: any[];
}

export const AgentTracePanel: React.FC<AgentTracePanelProps> = ({ 
  traceSteps, 
  isThinking,
  selectedSources = []
}) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const getToolIcon = (toolName?: string) => {
    if (!toolName) return Layers;
    if (toolName.includes('Weather') || toolName.includes('discover')) return CloudSun;
    if (toolName.includes('Knowledge') || toolName.includes('Document')) return BookOpen;
    if (toolName.includes('Memory')) return Brain;
    if (toolName.includes('Database') || toolName.includes('Plan')) return Database;
    return Zap;
  };

  return (
    <aside className="w-80 bg-white border-l-3 border-black h-full flex flex-col flex-shrink-0 z-10">
      {/* Header */}
      <div className="p-4 border-b-3 border-black bg-[#ccff00] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-black text-[#ccff00]">
            <Activity className="w-4 h-4 stroke-[3]" />
          </div>
          <h3 className="font-black text-sm text-black uppercase tracking-wider">Agent Execution Trace</h3>
        </div>
        {isThinking && (
          <span className="neo-badge bg-[#ff6b5b] text-black flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
            RUNNING
          </span>
        )}
      </div>

      {/* Main Steps Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e9d5ff]/30">
        {traceSteps.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-black p-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white border-3 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center">
              <Layers className="w-6 h-6 text-black stroke-[2.5]" />
            </div>
            <p className="text-xs font-black uppercase">No active execution trace</p>
            <p className="text-[11px] font-bold text-gray-700 leading-tight">
              Ask a query to observe real-time planner reasoning, dataset discovery, hybrid RAG, and memory isolation.
            </p>
          </div>
        ) : (
          traceSteps.map((step) => {
            const Icon = getToolIcon(step.toolName);
            const isExpanded = expandedStepId === step.id;

            return (
              <div 
                key={step.id} 
                className="bg-white rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_#000] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#ffe600] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#38bdf8] border-2 border-black flex items-center justify-center text-black flex-shrink-0">
                      <Icon className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-black truncate">{step.stepName}</p>
                      {step.toolName && (
                        <span className="text-[10px] font-mono font-black text-black uppercase bg-[#ccff00] px-1.5 py-0.2 rounded border border-black inline-block mt-0.5">
                          {step.toolName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-black fill-[#ccff00]" />
                    ) : step.status === 'running' ? (
                      <Clock className="w-4 h-4 text-black animate-spin" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-black" />
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-black stroke-[3]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-black stroke-[3]" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-2 border-t-2 border-black bg-gray-50 text-[11px] font-mono space-y-2">
                    {step.latencyMs !== undefined && (
                      <div className="text-black font-bold">Latency: <span className="bg-[#ccff00] px-1 border border-black rounded">{step.latencyMs}ms</span></div>
                    )}
                    {step.input && (
                      <div>
                        <div className="text-black font-bold uppercase text-[10px] mb-0.5">Input Parameters:</div>
                        <pre className="p-2 rounded-lg bg-white border-2 border-black text-black overflow-x-auto text-[10px] font-bold">
                          {JSON.stringify(step.input, null, 2)}
                        </pre>
                      </div>
                    )}
                    {step.output && (
                      <div>
                        <div className="text-black font-bold uppercase text-[10px] mb-0.5">Output Records:</div>
                        <pre className="p-2 rounded-lg bg-white border-2 border-black text-black overflow-x-auto text-[10px] font-bold">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Grounded Sources Section */}
        {selectedSources.length > 0 && (
          <div className="mt-4 pt-4 border-t-3 border-black space-y-2">
            <h4 className="text-xs font-black text-black uppercase flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 stroke-[2.5]" /> Grounded Evidence
            </h4>
            <div className="space-y-2">
              {selectedSources.map((source, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] text-[11px] space-y-1 font-bold">
                  <div className="flex items-center justify-between">
                    <span className="neo-badge bg-[#38bdf8] text-black">
                      {source.type || 'Source'}
                    </span>
                    {source.isMock ? (
                      <span className="neo-badge bg-[#ffe600] text-black flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3 stroke-[2.5]" /> DEMO
                      </span>
                    ) : (
                      <span className="neo-badge bg-[#ccff00] text-black flex items-center gap-0.5">
                        <Shield className="w-3 h-3 stroke-[2.5]" /> OFFICIAL
                      </span>
                    )}
                  </div>
                  <div className="text-black font-black">{source.source || source.title}</div>
                  {source.datasetId && (
                    <div className="text-[10px] font-mono text-black">Dataset: {source.datasetId}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
