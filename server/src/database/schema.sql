-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default demo user insertion
INSERT INTO users (id, email, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'student@veridex.ai', 'BTech Demo Student')
ON CONFLICT (email) DO NOTHING;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'agent', 'system')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Government Dataset Registry Table
CREATE TABLE IF NOT EXISTS knowledge_datasets (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    record_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Connected User Custom Data Sources Table
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'api_key', 'bearer')),
    auth_config JSONB DEFAULT '{}'::jsonb,
    encrypted_credentials TEXT,
    refresh_interval INTEGER NOT NULL DEFAULT 10,
    status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY' CHECK (status IN ('HEALTHY', 'DEGRADED', 'ERROR', 'DISABLED')),
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    schema JSONB DEFAULT '[]'::jsonb,
    record_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS data_sources_user_id_idx ON data_sources(user_id);
CREATE INDEX IF NOT EXISTS data_sources_status_idx ON data_sources(status);
CREATE INDEX IF NOT EXISTS data_sources_is_active_idx ON data_sources(is_active);

-- Canonical Unified Live & Static Knowledge Records Table
CREATE TABLE IF NOT EXISTS knowledge_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('api_feed', 'dataset', 'document', 'web')),
    dataset_id VARCHAR(100) REFERENCES knowledge_datasets(id) ON DELETE SET NULL,
    source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    structured_data JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    content_hash VARCHAR(64) NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE;
ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Vector HNSW Index on knowledge_records
CREATE INDEX IF NOT EXISTS knowledge_records_embedding_idx 
ON knowledge_records USING hnsw (embedding vector_cosine_ops);

-- B-Tree Indexes on knowledge_records
CREATE INDEX IF NOT EXISTS knowledge_records_content_hash_idx ON knowledge_records(content_hash);
CREATE INDEX IF NOT EXISTS knowledge_records_dataset_id_idx ON knowledge_records(dataset_id);
CREATE INDEX IF NOT EXISTS knowledge_records_source_idx ON knowledge_records(source);
CREATE INDEX IF NOT EXISTS knowledge_records_valid_from_idx ON knowledge_records(valid_from);
CREATE INDEX IF NOT EXISTS knowledge_records_observed_at_idx ON knowledge_records(observed_at);
CREATE INDEX IF NOT EXISTS knowledge_records_user_id_idx ON knowledge_records(user_id);
CREATE INDEX IF NOT EXISTS knowledge_records_source_id_idx ON knowledge_records(source_id);

-- Documents table (Static Knowledge Base Files)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    chunk_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'indexed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Chunks table (with pgvector embedding)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vector Index on document_chunks
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- Long-Term Memory table (with pgvector embedding)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('semantic', 'episodic', 'preference')),
    content TEXT NOT NULL,
    importance VARCHAR(20) DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vector Index on memories
CREATE INDEX IF NOT EXISTS memories_embedding_idx 
ON memories USING hnsw (embedding vector_cosine_ops);

-- Agent Runs table (Execution history)
CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    selected_tools JSONB DEFAULT '[]'::jsonb,
    response_latency_ms INTEGER DEFAULT 0,
    token_usage JSONB DEFAULT '{}'::jsonb,
    final_answer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tool Calls table (Sub-steps for each agent run)
CREATE TABLE IF NOT EXISTS tool_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    tool_input JSONB DEFAULT '{}'::jsonb,
    tool_output JSONB DEFAULT '{}'::jsonb,
    latency_ms INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Live Data Cache table
CREATE TABLE IF NOT EXISTS live_data_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
