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
  BookOpen
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
    if (toolName.includes('Weather')) return CloudSun;
    if (toolName.includes('Knowledge') || toolName.includes('Document')) return BookOpen;
    if (toolName.includes('Memory')) return Brain;
    if (toolName.includes('Database')) return Database;
    return Zap;
  };

  return (
    <aside className="w-80 glass-panel h-full flex flex-col border-l border-gray-800 flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-sm text-gray-200">Agent Execution Trace</h3>
        </div>
        {isThinking && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            Executing
          </span>
        )}
      </div>

      {/* Main Steps Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {traceSteps.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-4">
            <Layers className="w-8 h-8 mb-2 stroke-1 opacity-50" />
            <p className="text-xs font-medium">No active execution trace</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Ask a question to see real-time tool selection, memory lookup, and RAG evaluation.
            </p>
          </div>
        ) : (
          traceSteps.map((step) => {
            const Icon = getToolIcon(step.toolName);
            const isExpanded = expandedStepId === step.id;

            return (
              <div 
                key={step.id} 
                className="glass-card rounded-xl border border-gray-800/80 overflow-hidden transition-all hover:border-gray-700"
              >
                <button
                  onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-medium text-gray-200 truncate">{step.stepName}</p>
                      {step.toolName && (
                        <span className="text-[10px] font-mono text-indigo-400">{step.toolName}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : step.status === 'running' ? (
                      <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-gray-600" />
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-800/60 bg-gray-950/40 text-[11px] font-mono space-y-2">
                    {step.latencyMs !== undefined && (
                      <div className="text-gray-400">Latency: <span className="text-emerald-400">{step.latencyMs}ms</span></div>
                    )}
                    {step.input && (
                      <div>
                        <div className="text-gray-400 mb-0.5">Input:</div>
                        <pre className="p-2 rounded bg-gray-900 border border-gray-800 text-gray-300 overflow-x-auto text-[10px]">
                          {JSON.stringify(step.input, null, 2)}
                        </pre>
                      </div>
                    )}
                    {step.output && (
                      <div>
                        <div className="text-gray-400 mb-0.5">Output:</div>
                        <pre className="p-2 rounded bg-gray-900 border border-gray-800 text-gray-300 overflow-x-auto text-[10px]">
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
          <div className="mt-4 pt-4 border-t border-gray-800">
            <h4 className="text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Grounded Evidence Sources
            </h4>
            <div className="space-y-2">
              {selectedSources.map((source, idx) => (
                <div key={idx} className="p-2 rounded bg-gray-900/80 border border-gray-800 text-[11px]">
                  <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-indigo-500/20 text-indigo-300 uppercase mr-1.5">
                    {source.type}
                  </span>
                  <span className="text-gray-200 font-medium">{source.title}</span>
                  {source.page && <span className="text-gray-400 ml-1.5">• Pg {source.page}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
