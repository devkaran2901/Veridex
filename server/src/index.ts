import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config/env';
import { initDatabase } from './database/initDb';

import healthRoutes from './routes/health';
import chatRoutes from './routes/chat';
import documentRoutes from './routes/documents';
import memoryRoutes from './routes/memories';
import agentRunRoutes from './routes/agentRuns';

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
    // Attempt database initialization
    await initDatabase().catch((err) => {
      console.warn('⚠️ DB init failed on startup, server will proceed. Ensure Docker is running:', err.message);
    });

    server.listen(config.port, () => {
      console.log(`🚀 Veridex Agentic RAG Server listening on http://localhost:${config.port}`);
      console.log(`⚡ WebSocket Server initialized via Socket.IO`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
