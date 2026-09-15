# Veridex — AI Research & Intelligence Platform for Live Data

> **Ask questions. Research live data. Get evidence-backed answers.**

**Veridex** is an **Agentic RAG System over Continuously Updated External Data**, featuring document retrieval, long-term user memory, freshness-aware hybrid retrieval, versioned knowledge snapshots, custom REST/JSON API connectors, and zero-hallucination grounded synthesis.

Built with **React (Vite + Tailwind CSS)**, **Node.js (Express + TypeScript)**, **LangGraph.js**, **PostgreSQL with `pgvector`**, and **Socket.IO** for real-time agent execution streaming.

---

## 1. System Architecture

Veridex enforces the strict architectural pipeline:
`SOURCE ↓ INGEST ↓ KNOWLEDGE LAYER ↓ RETRIEVE ↓ AGENT ↓ ANSWER`

```
USER QUESTION
     │
     ▼
┌───────────────────────────────┐
│     LLM STRUCTURED PLANNER    │
│   (Query Intent & Routing)    │
└───────────────┬───────────────┘
                │ Typed Retrieval Plan (datasetIds, timeScope, retrievalMode)
  ┌─────────────┼───────────────┬─────────────────┐
  ▼             ▼               ▼                 ▼
Dataset       Live Knowledge   Static RAG        User Memory
Discovery     Layer Search     (PDF Chunks)      (User Preferences)
(data.gov.in) (pgvector/SQL)   (pgvector)        (pgvector)
  │             │               │                 │
  └─────────────┼───────────────┴─────────────────┘
                ▼
  ┌──────────────────────────┐
  │ CONTINUOUS LIVE INGESTION│ ◄── Background Scheduler Worker
  │ Source ──► Normalizer    │ (data.gov.in, Connected REST APIs)
  │ ──► Validator ──► Dedupe │
  │ (SHA-256) ──► Versioning │
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
         Grounded Answer + Sources + Freshness Score + Execution Trace
```

---

## 2. Key Architectural Features

1. **Central Knowledge Layer**:
   All external data (`data.gov.in` resources, user-connected REST APIs, uploaded PDFs) is ingested, normalized, validated, deduplicated, versioned, and embedded into PostgreSQL `knowledge_records`. An agent reasons over indexed knowledge records rather than bypassing the layer.

2. **No Fake Data & No Error Record Ingestion**:
   - `DATA_MODE=live` (Default): If a source is unavailable, the system reports **NO DATA** or source error status. Synthetic numbers or fake advisories are never fabricated.
   - Errors (`DATAGOV_API_KEY required`, HTTP failures) are logged and stored in `data_sources.last_error`, never inserted into `knowledge_records` as semantic evidence.

3. **Real `data.gov.in` First-Class Source**:
   Connects to official `data.gov.in` Open Government Data Portal India using `DATAGOV_API_KEY`, supporting live catalog search (`/catalog/search`) and actual resource API record fetching (`/resource/{resource_id}`).

4. **Connected User Custom REST APIs**:
   Users can connect any public or authenticated REST/JSON endpoint. Veridex auto-detects schema, previews records, encrypts credentials, and ingests records into `knowledge_records` with scheduled background sync.

5. **Change Detection & Historical Versioning**:
   SHA-256 content hashing detects updates. Changed records increment `version = version + 1` and preserve previous version snapshots with `valid_until` timestamps, enabling temporal comparison queries (*"What changed since yesterday?"*).

6. **Freshness & Multi-Mode Retrieval**:
   - **Semantic RAG**: Cosine similarity over vector embeddings (`vector(1536)`).
   - **Structured SQL**: Parameterized SQL queries over `structured_data` fields.
   - **Hybrid Score**: `(Vector Sim * 0.5) + (Freshness * 0.3) + (Source Reliability * 0.2)`.
   - **Dataset-Aware**: Constrains search to selected dataset IDs (`datasetIds`).

7. **Structured Evidence Evaluation**:
   Multi-metric evaluation assessing relevance score, freshness decay, and source quality before synthesizing an answer. If evidence is missing, the agent honestly states that the requested information is not available in the connected knowledge sources.

8. **Security & Ownership**:
   Enforces user ownership (`user_id`) on custom data sources and validates `CREDENTIAL_ENCRYPTION_KEY` in production environments.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons | Neo-brutalist dashboard with real-time trace execution panel |
| **Backend** | Node.js, Express.js, TypeScript | Modular REST API and WebSocket event dispatcher |
| **Agent Engine** | LangGraph.js, LangChain.js, Groq / OpenAI LLMs | State machine workflow & structured LLM retrieval planner |
| **Vector DB** | PostgreSQL 16 + `pgvector` extension | Vector embeddings storage (`vector(1536)`) with HNSW indexes |
| **Data Ingestion** | data.gov.in OGD Platform, Custom REST APIs | Continuous background worker sync & SHA-256 deduplication |
| **Real-Time** | Socket.IO | Streaming intermediate tool execution steps & latencies |
| **DevOps** | Docker, Docker Compose | Containerized database infrastructure |

---

## 4. Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- Docker & Docker Desktop

### 1. Environment Configuration (`.env`)
Create or edit `.env` in project root:
```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USER=veridex_user
DB_PASSWORD=veridex_password
DB_NAME=veridex_db

# LLM Provider: Groq (Free) or OpenAI
GROQ_API_KEY=gsk_your_free_groq_api_key_here
OPENAI_API_KEY=

# data.gov.in Official API Key
DATAGOV_API_KEY=

# Secret Encryption Key for Data Source Credentials
CREDENTIAL_ENCRYPTION_KEY=veridex-default-secret-key-32chars!!

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

### 5. Run Automated Architectural E2E Test Suite
```bash
cd server
npx tsx src/evaluation/e2eTest.ts
```
