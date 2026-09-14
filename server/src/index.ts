import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/env';
import { initDatabase } from './database/initDb';
import { seedInitialKnowledgeIfNeeded } from './ingestion/ingestionPipeline';

import healthRoutes from './routes/health';
import chatRoutes from './routes/chat';
import documentRoutes from './routes/documents';
import memoryRoutes from './routes/memories';
import agentRunRoutes from './routes/agentRuns';
import ingestionRoutes from './routes/ingestion';

const app = express();
const server = http.createServer(app);

// Enable Socket.IO
export const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/agent-runs', agentRunRoutes);
app.use('/api/ingestion', ingestionRoutes);

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log(`🔌 Socket client connected: ${socket.id}`);

  socket.on('join_conversation', (conversationId: string) => {
    socket.join(conversationId);
    console.log(`📡 Socket ${socket.id} joined conversation room: ${conversationId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket client disconnected: ${socket.id}`);
  });
});

// Startup sequence
async function startServer() {
  try {
    // Database initialization & Knowledge seed
    await initDatabase()
      .then(() => seedInitialKnowledgeIfNeeded())
      .catch((err) => {
        console.warn('⚠️ DB init failed on startup, server will proceed. Ensure Docker is running:', err.message);
      });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.port} is already in use! Please terminate process on port ${config.port}.`);
      }
    });

    server.listen(config.port, () => {
      console.log(`🚀 Veridex Agentic RAG Server listening on http://localhost:${config.port}`);
      console.log(`⚡ WebSocket Server initialized via Socket.IO`);
    });

    process.on('SIGTERM', () => {
      server.close();
    });
    process.on('SIGINT', () => {
      server.close();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
