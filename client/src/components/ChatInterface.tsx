import React, { useState } from 'react';
import { Send, Sparkles, Bot, User, CloudSun, BookOpen, Brain, Compass } from 'lucide-react';

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
      title: "Document RAG",
      prompt: "What does the government report say about flood management?",
      icon: BookOpen,
      badge: "PDF Search",
      color: "bg-[#2563eb] text-white"
    },
    {
      title: "Live API Feed",
      prompt: "What is the current weather in Delhi?",
      icon: CloudSun,
      badge: "Real-Time Feed",
      color: "bg-[#e63946] text-white"
    },
    {
      title: "Long-Term Memory",
      prompt: "What are my preferences for travelling?",
      icon: Brain,
      badge: "User Memory",
      color: "bg-[#fbbf24] text-black"
    },
    {
      title: "Multi-Tool Synthesis",
      prompt: "Considering today's weather, government advisories, and my travel preferences, should I travel to Delhi tomorrow?",
      icon: Compass,
      badge: "Multi-Source RAG",
      color: "bg-[#1c1917] text-white"
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f4f1ea] relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto mt-4 space-y-8 text-center">
            {/* Hero Card */}
            <div className="bauhaus-card p-8 space-y-4 text-center border-2 border-[#1c1917] bg-white shadow-bauhaus">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-6 h-6 bg-[#e63946] border border-[#1c1917] inline-block" />
                <span className="w-6 h-6 bg-[#2563eb] rounded-full border border-[#1c1917] inline-block" />
                <span className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-b-[#fbbf24] inline-block" />
              </div>
              <h2 className="text-3xl font-extrabold text-[#1c1917] uppercase tracking-tight font-display">
                Veridex Agentic RAG Workstation
              </h2>
              <p className="text-[#1c1917]/80 text-xs font-bold max-w-lg mx-auto leading-relaxed">
                Autonomous AI engine over Live Government APIs, PostgreSQL pgvector RAG, and Long-Term Memory.
              </p>
            </div>

            {/* Suggested Prompts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {suggestedQuestions.map((q, i) => {
                const Icon = q.icon;
                return (
                  <button
                    key={i}
                    onClick={() => onSendMessage(q.prompt)}
                    className="p-5 rounded-lg bg-white border-2 border-[#1c1917] shadow-bauhaus hover:bg-[#e63946] hover:text-white transition-all text-left group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-2">
                        <span className={`p-1.5 rounded-full border border-[#1c1917] ${q.color}`}>
                          <Icon className="w-4 h-4 stroke-[2.5]" />
                        </span>
                        {q.title}
                      </span>
                      <span className="bauhaus-badge bg-[#1c1917] text-white text-[9px] group-hover:bg-white group-hover:text-black">
                        {q.badge}
                      </span>
                    </div>
                    <p className="text-xs font-bold leading-snug">
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
                  className={`w-9 h-9 rounded-full border-2 border-[#1c1917] flex items-center justify-center flex-shrink-0 font-extrabold ${
                    isUser
                      ? 'bg-[#e63946] text-white'
                      : 'bg-[#2563eb] text-white'
                  }`}
                >
                  {isUser ? <User className="w-5 h-5 stroke-[2.5]" /> : <Bot className="w-5 h-5 stroke-[2.5]" />}
                </div>

                {/* Content Bubble */}
                <div
                  className={`p-5 rounded-2xl text-xs font-bold leading-relaxed border-2 border-[#1c1917] shadow-bauhaus ${
                    isUser
                      ? 'bg-[#e63946] text-white rounded-tr-none'
                      : 'bg-white text-[#1c1917] rounded-tl-none space-y-4'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Citations / Sources Tagging */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-4 border-t-2 border-[#1c1917] space-y-2">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1c1917]">
                        CITED EVIDENCE & SOURCES:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cite, idx) => (
                          <span
                            key={idx}
                            className="bauhaus-badge bg-[#fbbf24] text-black flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1c1917]" />
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
            <div className="w-9 h-9 rounded-full bg-[#2563eb] border-2 border-[#1c1917] text-white flex items-center justify-center">
              <Bot className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="p-4 rounded-2xl rounded-tl-none bg-white border-2 border-[#1c1917] shadow-bauhaus text-xs font-extrabold text-[#1c1917] flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e63946] border border-[#1c1917] animate-ping" />
              <span>VERIDEX AGENT IS REASONING & RETRIEVING EVIDENCE...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box Bar */}
      <div className="p-4 border-t-2 border-[#1c1917] bg-[#f4f1ea]">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask anything (e.g., 'What is today's weather in Delhi?')"
            className="w-full py-3 pl-6 pr-14 rounded-full bg-white border-2 border-[#1c1917] text-[#1c1917] placeholder-gray-500 font-bold text-xs outline-none shadow-bauhaus focus:border-[#2563eb] transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="absolute right-2 p-2 rounded-full bauhaus-btn-accent text-white disabled:opacity-40 flex items-center justify-center"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>
        <p className="text-[10px] font-bold text-[#1c1917]/70 text-center mt-2 flex items-center justify-center gap-1">
          Press <kbd className="px-1.5 py-0.5 rounded bg-[#fbbf24] border border-[#1c1917] text-[#1c1917] font-extrabold">ENTER</kbd> to execute Agentic query
        </p>
      </div>
    </div>
  );
};
