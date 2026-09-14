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
    <aside className="w-80 bg-[#f4f1ea] border-l-2 border-[#1c1917] h-full flex flex-col flex-shrink-0 z-10">
      {/* Header */}
      <div className="p-4 border-b-2 border-[#1c1917] bg-[#e63946] text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-[#1c1917] text-white">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <h3 className="font-extrabold text-xs uppercase tracking-wider font-display">Execution Trace</h3>
        </div>
        {isThinking && (
          <span className="bauhaus-badge bg-[#fbbf24] text-black flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#1c1917] animate-ping" />
            RUNNING
          </span>
        )}
      </div>

      {/* Main Steps Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f4f1ea]">
        {traceSteps.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#1c1917] p-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-[#1c1917] flex items-center justify-center shadow-sm">
              <Layers className="w-6 h-6 text-[#1c1917] stroke-[2.5]" />
            </div>
            <p className="text-xs font-extrabold uppercase">No active execution trace</p>
            <p className="text-[10px] font-bold text-[#1c1917]/70 leading-tight">
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
                className="bg-white rounded-lg border-2 border-[#1c1917] shadow-sm overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-[#eae6df] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#2563eb] text-white border border-[#1c1917] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-extrabold text-[#1c1917] truncate">{step.stepName}</p>
                      {step.toolName && (
                        <span className="text-[9px] font-mono font-extrabold text-white uppercase bg-[#1c1917] px-1.5 py-0.2 rounded-full inline-block mt-0.5">
                          {step.toolName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#e63946]" />
                    ) : step.status === 'running' ? (
                      <Clock className="w-4 h-4 text-[#2563eb] animate-spin" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1c1917]" />
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#1c1917] stroke-[2.5]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#1c1917] stroke-[2.5]" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-2 border-t border-[#1c1917] bg-[#eae6df] text-[10px] font-mono space-y-2">
                    {step.latencyMs !== undefined && (
                      <div className="text-[#1c1917] font-bold">Latency: <span className="bg-[#fbbf24] text-black px-1 border border-[#1c1917] rounded">{step.latencyMs}ms</span></div>
                    )}
                    {step.input && (
                      <div>
                        <div className="text-[#1c1917] font-bold uppercase text-[9px] mb-0.5">Input Parameters:</div>
                        <pre className="p-2 rounded bg-[#1c1917] text-white overflow-x-auto text-[9px] font-mono">
                          {JSON.stringify(step.input, null, 2)}
                        </pre>
                      </div>
                    )}
                    {step.output && (
                      <div>
                        <div className="text-[#1c1917] font-bold uppercase text-[9px] mb-0.5">Output Records:</div>
                        <pre className="p-2 rounded bg-[#1c1917] text-white overflow-x-auto text-[9px] font-mono">
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
          <div className="mt-4 pt-4 border-t-2 border-[#1c1917] space-y-2">
            <h4 className="text-xs font-extrabold text-[#1c1917] uppercase flex items-center gap-1.5 font-display">
              <BookOpen className="w-4 h-4 stroke-[2.5]" /> Grounded Evidence
            </h4>
            <div className="space-y-2">
              {selectedSources.map((source, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-white border border-[#1c1917] shadow-sm text-[10px] space-y-1 font-bold">
                  <div className="flex items-center justify-between">
                    <span className="bauhaus-badge bg-[#2563eb] text-white">
                      {source.type || 'Source'}
                    </span>
                    {source.isMock ? (
                      <span className="bauhaus-badge bg-[#fbbf24] text-black flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3 stroke-[2.5]" /> DEMO
                      </span>
                    ) : (
                      <span className="bauhaus-badge bg-[#e63946] text-white flex items-center gap-0.5">
                        <Shield className="w-3 h-3 stroke-[2.5]" /> OFFICIAL
                      </span>
                    )}
                  </div>
                  <div className="text-[#1c1917] font-extrabold">{source.source || source.title}</div>
                  {source.datasetId && (
                    <div className="text-[9px] font-mono text-[#1c1917]/70">Dataset: {source.datasetId}</div>
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
