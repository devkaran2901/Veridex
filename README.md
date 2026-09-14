# Veridex: Agentic RAG System over Continuously Updated Live Data with Long-Term Memory

**Veridex** is an advanced **Agentic RAG Engine** built with **React (Vite + Tailwind CSS)**, **Node.js (Express + TypeScript)**, **LangGraph.js**, **PostgreSQL with `pgvector`**, and **Socket.IO** for real-time agent execution streaming.

Unlike basic chatbots that blindly perform vector search or call direct API tools on every query, Veridex implements a **Continuously Updated Live Knowledge Layer**. Live government data (IMD weather feeds, data.gov.in datasets, NDMA advisories) is continuously ingested, validated, deduplicated via SHA-256, versioned, and indexed into PostgreSQL `knowledge_records`. An **LLM Structured Planner** formulates typed retrieval plans and executes hybrid vector + parameterized SQL queries with freshness decay scoring.

---

## 1. System Architecture

```
USER QUERY
    │
    ▼
┌───────────────────────────────┐
│     LLM STRUCTURED PLANNER    │
│  (RetrievalPlan Generator)    │
└───────────────┬───────────────┘
                │ Typed Retrieval Plan
  ┌─────────────┼───────────────┬─────────────────┐
  ▼             ▼               ▼                 ▼
Dataset       Live Knowledge   Static RAG        Memory
Discovery     Layer Search     (PDF Chunks)      Layer Search
(data.gov.in) (pgvector/SQL)   (pgvector)        (pgvector)
  │             │               │                 │
  └─────────────┼───────────────┴─────────────────┘
                ▼
  ┌──────────────────────────┐
  │ CONTINUOUS LIVE INGESTION│ ◄── Background Scheduler Worker
  │ Provider ──► Normalizer  │ (IMD, data.gov.in, NDMA)
  │ ──► Validator ──► Dedupe │
  │ (SHA256) ──► Versioning  │
  └─────────────┬────────────┘
                ▼
  ┌──────────────────────────┐
  │ PostgreSQL + pgvector    │
  │ (knowledge_records)      │
  └─────────────┬────────────┘
                ▼
  ┌──────────────────────────┐
  │ Hybrid Freshness-Aware   │
  │ Retrieval & SQL Engine   │
  └─────────────┬────────────┘
                ▼
  ┌──────────────────────────┐
  │ Evidence Evaluation      │ ── Inadequate? ──► Refine Plan (Loop)
  └─────────────┬────────────┘
                ▼
  ┌──────────────────────────┐
  │ Grounded LLM Synthesis   │
  │ + Traceable Citations    │
  └─────────────┬────────────┘
                ▼
         Grounded Response + Sources + Data Age + Trace
```

---

## 2. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons | Glassmorphism Dashboard with real-time execution trace panel |
| **Backend** | Node.js, Express.js, TypeScript | Modular REST API and WebSocket event dispatching |
| **Agent Engine** | LangGraph.js, LangChain.js, OpenAI / Groq LLMs | State machine workflow & structured LLM retrieval planning |
| **Vector DB** | PostgreSQL 16 + `pgvector` extension | Vector embeddings storage (`vector(1536)`) with HNSW indexes |
| **Live Ingestion** | IMD Weather, data.gov.in catalog, NDMA Advisories | Continuous background worker sync & SHA-256 deduplication |
| **Real-Time** | Socket.IO | Streaming intermediate tool execution steps & latencies |
| **DevOps** | Docker, Docker Compose | Containerized database infrastructure |

---

## 3. Key Architectural Features

1. **Live Knowledge Layer as Central Concept**:
   External government data enters PostgreSQL `knowledge_records` via continuous ingestion workers. Agent reasoning operates over the indexed knowledge layer rather than raw direct API tools.

2. **Strict Mode Boundaries (`DATA_MODE=live` vs `DATA_MODE=demo`)**:
   - `DATA_MODE=live` (Default): If DB/APIs return no evidence, the system honestly reports that data is unavailable. No fake numbers or mock fallback records are fabricated.
   - `DATA_MODE=demo`: Mock providers may be used for testing, and all mock records are prominently tagged `[DEMO DATA]`.

3. **Data.gov.in Official Catalog & Dataset Discovery**:
   Assisted by LLM intent generation, searches official data.gov.in endpoints (`https://api.data.gov.in/catalog/search` & `/resource/{id}`). Preserves schema, publisher, geographic, and temporal metadata.

4. **Change Detection & Historical Version Snapshots**:
   SHA-256 content hashing detects updates. Changed records increment `version = version + 1` and preserve previous version snapshots with `valid_until` timestamps, enabling temporal comparison queries ("What changed since yesterday?").

5. **Multi-Mode Freshness-Aware Retrieval**:
   - **Semantic Vector RAG**: Cosine similarity over document & advisory text.
   - **Structured SQL**: Parameterized SQL queries for district rainfall/numerical rankings (`structured_data->>'rainfallMm'`).
   - **Hybrid Score**: `(Vector Sim * 0.5) + (Freshness * 0.3) + (Source Reliability * 0.2)`.

6. **User Memory Isolation**:
   User preferences are stored separately in `memories` table and retrieved ONLY when query intent demands personal context ("my travel preferences"). Prevents memory contamination.

---

## 4. API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check & `pgvector` connectivity test |
| `POST` | `/api/chat` | Main chat endpoint running LangGraph workflow |
| `GET` | `/api/ingestion/status` | Current data mode (`live`/`demo`), worker interval & record stats |
| `GET` | `/api/ingestion/datasets` | List registered government datasets and last sync stats |
| `GET` | `/api/ingestion/records` | List canonical knowledge records with freshness & versions |
| `POST` | `/api/ingestion/sync` | Trigger manual live data ingestion pipeline sync |
| `POST` | `/api/documents/upload` | Upload and index PDF or TXT document |
| `POST` | `/api/documents/search` | Direct vector search over static document RAG |
| `GET` | `/api/memories` | List long-term user memories |
| `POST` | `/api/memories` | Save a new long-term user preference |

---

## 5. Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- Docker & Docker Desktop

### 1. Environment Configuration (`.env`)
Copy `.env.example` to `.env` in the project root:
```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USER=veridex_user
DB_PASSWORD=veridex_password
DB_NAME=veridex_db

# Choose LLM Provider: Groq (Free) or OpenAI
GROQ_API_KEY=gsk_your_free_groq_api_key_here
OPENAI_API_KEY=

# data.gov.in API Key
DATAGOV_API_KEY=

# Data Mode (live = strict no-fake-data mode; demo = allows mock test data)
DATA_MODE=live

# Background Ingestion Interval (Minutes)
INGESTION_INTERVAL_MINUTES=10
```

### 2. Start PostgreSQL with pgvector via Docker
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

### 4. Start Frontend Dashboard
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
*(Executes all 8 mandatory benchmark user query test cases)*

---

## 6. Mandatory 8 User Test Query Benchmark

Run `npm run eval` to verify all 8 test cases:
1. `What is the current rainfall in Punjab?` → Dataset discovery → Live Knowledge Layer search
2. `Which Punjab district has received the highest rainfall recently?` → Structured SQL query
3. `What does the government recommend during heavy rainfall?` → Semantic RAG advisory
4. `What changed in Punjab rainfall since yesterday?` → Comparison mode & version snapshot diff
5. `What are my travel preferences?` → Long-Term User Memory retrieval
6. `Considering current rainfall and my travel preferences, should I travel?` → Live Knowledge + Memory reasoning
7. `What happened in Punjab rainfall last year?` → Historical scope retrieval
8. `What happens if the government API is unavailable?` → Honest no-evidence state (No fabrication)
