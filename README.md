# Veridex: Agentic RAG System over Live Data with Long-Term Memory

**Veridex** is a BTech CSE final-year project demonstrating a full-stack **Agentic RAG Engine** built with **React (Vite + Tailwind CSS)**, **Node.js (Express + TypeScript)**, **LangGraph.js**, **PostgreSQL with `pgvector`**, and **Socket.IO** for real-time agent execution streaming.

Unlike basic chatbots that blindly perform vector search on every question, Veridex is genuinely **agentic**. It dynamically analyzes user queries, determines which tools are needed (Live APIs, Vector RAG Knowledge Base, Long-Term User Memories, or Database analytics), executes selected tools, evaluates evidence sufficiency, and synthesizes grounded answers with strict source citations.

---

## 1. Core System Architecture

```mermaid
flowchart TD
    User([User / Browser]) <-->|HTTP REST & WebSockets| Frontend[React + Vite + Tailwind Dashboard]
    Frontend <-->|REST API + Socket.IO| Backend[Node.js + Express + TypeScript]

    subgraph LangGraph Agent Engine
        Analyze[Analyze Query Node] --> Decide{Tool Selector}
        Decide -->|Weather Query| Weather[getLiveWeather API]
        Decide -->|Disaster/Gov Advisory| GovData[getGovernmentData API]
        Decide -->|Document Query| RAG[searchKnowledgeBase RAG]
        Decide -->|User Habit/Preference| Memory[searchMemory Long-Term Memory]
        
        Weather --> Eval[Evaluate Evidence Node]
        GovData --> Eval
        RAG --> Eval
        Memory --> Eval
        
        Eval -->|Sufficient Context| Synthesize[Grounded LLM Synthesis Node]
        Eval -->|Needs More Info| Decide
    end

    Backend <--> LangGraph Agent Engine

    subgraph PostgreSQL + pgvector Persistence
        PG[(PostgreSQL Database)]
        PG --> Documents[(documents & document_chunks + vector)]
        PG --> Memories[(memories + vector)]
        PG --> AgentRuns[(agent_runs & tool_calls audit log)]
        PG --> Cache[(live_data_cache)]
    end

    RAG <-->|Cosine Similarity Search| Documents
    Memory <-->|Vector Search + Importance Weighting| Memories
```

---

## 2. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons | Glassmorphism Dashboard with real-time execution trace panel |
| **Backend** | Node.js, Express.js, TypeScript | Modular REST API and WebSocket event dispatching |
| **Agent Engine** | LangGraph.js, LangChain.js, OpenAI API (`gpt-4o-mini`) | State machine workflow & multi-tool reasoning |
| **Vector DB** | PostgreSQL 16 + `pgvector` extension | Vector embeddings storage (`vector(1536)`) with HNSW indexes |
| **Live APIs** | `wttr.in` Weather API, Government NDMA Portal | Real-time weather and public disaster advisories |
| **Real-Time** | Socket.IO | Streaming intermediate tool execution steps & latencies |
| **DevOps** | Docker, Docker Compose | 1-command containerized infrastructure |

---

## 3. Key Agent Tools

The agent intelligently selects among the following registered tools:
1. `getLiveWeather(location)`: Fetches real-time temperature, humidity, and rainfall probability via `wttr.in` or OpenWeather.
2. `getGovernmentData(topic, location)`: Fetches disaster management bulletins and transit alerts.
3. `searchKnowledgeBase(query)`: Performs vector similarity search over uploaded PDF/TXT document chunks in `pgvector`.
4. `searchMemory(query)`: Retrieves long-term user preferences, habits, and past decisions.
5. `saveMemory(content, memoryType, importance)`: Stores new preferences into PostgreSQL vector memory.
6. `queryDatabase(queryType)`: Performs safe analytical queries over database statistics.
7. `getCurrentTime()`: Fetches current system time and timezone context.

---

## 4. PostgreSQL Database Schema

The system uses a unified PostgreSQL database with `pgvector` enabled:

- `users`: User profiles.
- `conversations` & `messages`: Chat history and citation metadata.
- `documents` & `document_chunks`: Document text passages with `vector(1536)` embeddings and HNSW indexes (`vector_cosine_ops`).
- `memories`: Long-term user memories categorized as `semantic`, `episodic`, or `preference` with `vector(1536)` embeddings.
- `agent_runs` & `tool_calls`: Audit logs recording every query run, tool latencies, and token usage.
- `live_data_cache`: External API cache with expiration timestamps.

---

## 5. RAG & Long-Term Memory Pipeline

### Document RAG Pipeline
```
Document Upload (PDF/TXT) 
↓ 
Text Extraction (pdf-parse) 
↓ 
Recursive Chunking (500 chars, 50 overlap) 
↓ 
Vector Embedding Generation (text-embedding-3-small / 1536-dim) 
↓ 
PostgreSQL pgvector HNSW Storage 
↓ 
Cosine Distance Retrieval (1 - (embedding <=> query))
```

### Memory System
- **Categories**: Short-Term (conversation state), Semantic (long-term facts), Episodic (key decisions), Preference (user travel/communication choices).
- **Scoring**: Combines vector cosine similarity with importance multipliers (`high` = 1.2x, `medium` = 1.0x, `low` = 0.8x).

---

## 6. API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check & `pgvector` connectivity test |
| `POST` | `/api/chat` | Main chat endpoint running LangGraph workflow |
| `GET` | `/api/conversations` | List user conversation history |
| `POST` | `/api/documents/upload` | Upload and index PDF or TXT document |
| `POST` | `/api/documents/search` | Direct vector search over RAG Knowledge Base |
| `GET` | `/api/memories` | List long-term user memories |
| `POST` | `/api/memories` | Save a new long-term preference |
| `POST` | `/api/memories/search` | Vector search over long-term memory store |
| `GET` | `/api/agent-runs` | List historical agent execution audit logs |

---

## 7. Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- Docker & Docker Desktop

### 1. Environment Variables (`.env`)
Copy `.env.example` to `.env` in the root directory:
```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USER=veridex_user
DB_PASSWORD=veridex_password
DB_NAME=veridex_db

OPENAI_API_KEY=your_openai_api_key_here
WEATHER_API_KEY=mock-key
```
*(Note: A Mock LLM & Mock Vector Provider fallback is active automatically if no OpenAI API key is supplied!)*

### 2. Start PostgreSQL via Docker
```bash
docker compose up -d postgres
```

### 3. Start Backend Server
```bash
cd server
npm install
npm run dev
```
*(Runs on `http://localhost:5000`)*

### 4. Start Frontend Client
```bash
cd client
npm install
npm run dev
```
*(Runs on `http://localhost:5173`)*

### 5. Run Automated Evaluation Benchmark Suite
```bash
cd server
npm run eval
```


