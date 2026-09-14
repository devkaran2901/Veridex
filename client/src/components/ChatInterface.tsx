import React, { useState } from 'react';
import { Send, Sparkles, Bot, User, CornerDownLeft, CloudSun, BookOpen, Brain, Compass } from 'lucide-react';

export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  citations?: any[];
  createdAt: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  isThinking: boolean;
  onSendMessage: (text: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isThinking,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');

  const suggestedQuestions = [
    {
      title: "RAG Query",
      prompt: "What does the government report say about flood management?",
      icon: BookOpen,
      badge: "Document Retrieval"
    },
    {
      title: "Live API Query",
      prompt: "What is the current weather in Delhi?",
      icon: CloudSun,
      badge: "Real-time Weather"
    },
    {
      title: "Long-Term Memory Query",
      prompt: "What are my preferences for travelling?",
      icon: Brain,
      badge: "Memory Retrieval"
    },
    {
      title: "Multi-Tool Reasoning",
      prompt: "Considering today's weather, government advisories, and my travel preferences, should I travel to Delhi tomorrow?",
      icon: Compass,
      badge: "Weather + RAG + Memory"
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f19]/60 relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-8 space-y-8 text-center">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 glow-indigo">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Veridex Intelligence Agent
              </h2>
              <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                An agentic AI system that dynamically decides between Live Data APIs, pgvector Document Search, and PostgreSQL Long-Term Memory.
              </p>
            </div>

            {/* Suggested Prompts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              {suggestedQuestions.map((q, i) => {
                const Icon = q.icon;
                return (
                  <button
                    key={i}
                    onClick={() => onSendMessage(q.prompt)}
                    className="p-4 rounded-xl glass-card border border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-600/5 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" /> {q.title}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-mono">
                        {q.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 group-hover:text-white transition-colors leading-snug">
                      "{q.prompt}"
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>

                {/* Content Bubble */}
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'glass-panel border border-gray-800 text-gray-200 rounded-tl-none space-y-3'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Citations / Sources Tagging */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-3 border-t border-gray-800/80 space-y-1.5">
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        Retrieved Sources:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cite, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-xs font-mono text-indigo-300 flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            {cite.source} {cite.page ? `(Pg ${cite.page})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isThinking && (
          <div className="flex gap-4 max-w-3xl">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="glass-panel p-4 rounded-2xl rounded-tl-none border border-gray-800 text-sm text-gray-400 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Veridex Agent is selecting tools and evaluating evidence...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box Bar */}
      <div className="p-4 border-t border-gray-800 glass-panel">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask anything (e.g., 'What is today's weather in Delhi?')"
            className="w-full py-3.5 pl-4 pr-12 rounded-xl bg-gray-900/90 border border-gray-800 focus:border-indigo-500 text-white placeholder-gray-500 text-sm outline-none transition-all shadow-inner"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="absolute right-2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[11px] text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
          Press <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 font-mono">Enter</kbd> to submit query
        </p>
      </div>
    </div>
  );
};
