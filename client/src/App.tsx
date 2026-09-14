import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatInterface, Message } from './components/ChatInterface';
import { AgentTracePanel, TraceStep } from './components/AgentTracePanel';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { MemoriesPage } from './pages/MemoriesPage';
import { AgentRunsPage } from './pages/AgentRunsPage';
import { SettingsPage } from './pages/SettingsPage';
import { socket } from './services/socket';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const [selectedSources, setSelectedSources] = useState<any[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    checkHealth();

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('agent_step', (step: TraceStep) => {
      setTraceSteps((prev) => [...prev, step]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('agent_step');
    };
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setDbConnected(data.database?.connected ?? false);
      }
    } catch {
      setDbConnected(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setTraceSteps([]);
    setSelectedSources([]);
    setActiveTab('chat');
  };

  const handleSendMessage = async (text: string) => {
    // Append User message locally
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);
    setTraceSteps([
      {
        id: '1',
        stepName: 'Query Analyzed',
        status: 'completed',
        input: { query: text },
        latencyMs: 45,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (res.ok) {
        const data = await res.json();
        setConversationId(data.conversationId);

        const agentMsg: Message = {
          id: data.message.id || Date.now().toString(),
          sender: 'agent',
          content: data.message.content,
          citations: data.message.citations || [],
          createdAt: data.message.created_at || new Date().toISOString(),
        };

        setMessages((prev) => [...prev, agentMsg]);
        setTraceSteps((prev) => [
          ...prev,
          {
            id: '2',
            stepName: 'Response Synthesized',
            status: 'completed',
            latencyMs: 120,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0f19]">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onNewChat={handleNewChat} 
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <Header dbConnected={dbConnected} socketConnected={socketConnected} />

        <main className="flex-1 flex min-h-0 relative">
          {activeTab === 'chat' && (
            <ChatInterface
              messages={messages}
              isThinking={isThinking}
              onSendMessage={handleSendMessage}
            />
          )}
          {activeTab === 'knowledge' && <KnowledgeBasePage />}
          {activeTab === 'memories' && <MemoriesPage />}
          {activeTab === 'runs' && <AgentRunsPage />}
          {activeTab === 'settings' && <SettingsPage />}

          {/* Right Agent Trace Panel (Always visible during chat) */}
          {activeTab === 'chat' && (
            <AgentTracePanel
              traceSteps={traceSteps}
              isThinking={isThinking}
              selectedSources={selectedSources}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
