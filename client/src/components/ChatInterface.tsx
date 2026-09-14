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
      color: "bg-[#38bdf8]"
    },
    {
      title: "Live API Feed",
      prompt: "What is the current weather in Delhi?",
      icon: CloudSun,
      badge: "Real-Time Feed",
      color: "bg-[#ccff00]"
    },
    {
      title: "Long-Term Memory",
      prompt: "What are my preferences for travelling?",
      icon: Brain,
      badge: "User Memory",
      color: "bg-[#d8b4fe]"
    },
    {
      title: "Multi-Tool Synthesis",
      prompt: "Considering today's weather, government advisories, and my travel preferences, should I travel to Delhi tomorrow?",
      icon: Compass,
      badge: "Multi-Source RAG",
      color: "bg-[#ff6b5b]"
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#e9d5ff]/40 relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto mt-4 space-y-8 text-center">
            <div className="neo-box bg-white p-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#ccff00] border-3 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-9 h-9 text-black fill-[#ff6b5b]" />
              </div>
              <h2 className="text-3xl font-black text-black uppercase tracking-tight">
                Veridex Agentic RAG Assistant
              </h2>
              <p className="text-black text-sm font-bold max-w-lg mx-auto leading-relaxed">
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
                    className="p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#000] hover:bg-[#ffe600] transition-all text-left group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black uppercase text-black flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg border-2 border-black ${q.color}`}>
                          <Icon className="w-4 h-4 text-black stroke-[2.5]" />
                        </span>
                        {q.title}
                      </span>
                      <span className="neo-badge bg-black text-white text-[10px]">
                        {q.badge}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-black leading-snug">
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
                  className={`w-10 h-10 rounded-xl border-3 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center flex-shrink-0 font-black ${
                    isUser
                      ? 'bg-[#ffe600] text-black'
                      : 'bg-[#ccff00] text-black'
                  }`}
                >
                  {isUser ? <User className="w-6 h-6 stroke-[2.5]" /> : <Bot className="w-6 h-6 stroke-[2.5]" />}
                </div>

                {/* Content Bubble */}
                <div
                  className={`p-5 rounded-2xl text-sm font-bold leading-relaxed border-3 border-black shadow-[4px_4px_0px_0px_#000] ${
                    isUser
                      ? 'bg-[#ffe600] text-black rounded-tr-none'
                      : 'bg-white text-black rounded-tl-none space-y-4'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Citations / Sources Tagging */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-4 border-t-3 border-black space-y-2">
                      <div className="text-[11px] font-black text-black uppercase tracking-wider">
                        CITED EVIDENCE & SOURCES:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cite, idx) => (
                          <span
                            key={idx}
                            className="neo-badge bg-[#ccff00] text-black flex items-center gap-1.5"
                          >
                            <span className="w-2 h-2 rounded-full bg-black" />
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
            <div className="w-10 h-10 rounded-xl bg-[#ccff00] border-3 border-black shadow-[3px_3px_0px_0px_#000] text-black flex items-center justify-center">
              <Bot className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="p-4 rounded-2xl rounded-tl-none bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000] text-xs font-black text-black flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#ff6b5b] border-2 border-black animate-ping" />
              <span>VERIDEX AGENT IS REASONING & RETRIEVING EVIDENCE...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box Bar */}
      <div className="p-4 border-t-3 border-black bg-white">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask anything (e.g., 'What is today's weather in Delhi?')"
            className="w-full py-3.5 pl-5 pr-14 rounded-2xl bg-white border-3 border-black text-black placeholder-gray-500 font-bold text-sm outline-none shadow-[4px_4px_0px_0px_#000] focus:shadow-[6px_6px_0px_0px_#000] transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="absolute right-2.5 p-2.5 rounded-xl neo-btn disabled:opacity-40 flex items-center justify-center"
          >
            <Send className="w-4 h-4 stroke-[3]" />
          </button>
        </form>
        <p className="text-[11px] font-bold text-black text-center mt-2 flex items-center justify-center gap-1">
          Press <kbd className="px-1.5 py-0.5 rounded bg-[#ffe600] border-2 border-black font-black">ENTER</kbd> to execute Agentic query
        </p>
      </div>
    </div>
  );
};
