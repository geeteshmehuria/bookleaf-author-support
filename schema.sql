-- ============================================================================
-- BookLeaf Author Support & Communication Portal
-- Production PostgreSQL Database Schema (schema.sql)
-- Target: PostgreSQL 14+
-- ============================================================================

-- 1. Ensure required extensions in public or system space
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create and set dedicated application schema 'app' (avoids polluting 'public')
CREATE SCHEMA IF NOT EXISTS app;
SET search_path TO app, public;

-- ============================================================================
-- ENUM TYPES (Created inside 'app' schema)
-- Reusable enum definitions for DB, Backend (Pydantic), and Frontend
-- ============================================================================
CREATE TYPE app.ticket_status AS ENUM (
    'Open',
    'In Progress',
    'Resolved',
    'Closed'
);

CREATE TYPE app.ticket_priority AS ENUM (
    'Critical',
    'High',
    'Medium',
    'Low'
);

CREATE TYPE app.ticket_category AS ENUM (
    'Royalty & Payments',
    'ISBN & Metadata Issues',
    'Printing & Quality',
    'Distribution & Availability',
    'Book Status & Production Updates',
    'General Inquiry'
);

CREATE TYPE app.llm_log_status AS ENUM (
    'success',
    'rate_limited',
    'fallback',
    'failed'
);

-- ============================================================================
-- 1. ROLES TABLE (Master lookup for role-based access control)
-- ============================================================================
CREATE TABLE app.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,       -- 'author', 'admin'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app.roles (name, description) VALUES 
('author', 'BookLeaf Author - access to own books, queries, and tickets'),
('admin', 'BookLeaf Operations & Support Team - full access to queue, triage, notes, and replies');

-- ============================================================================
-- 2. USERS TABLE
-- Stores author accounts ('AUTH001'..'AUTH010') and admin accounts ('ADMIN001')
-- Role permissions (who can assign tickets, write internal notes) are enforced
-- strictly at the API layer (FastAPI dependencies require_admin / get_current_user).
-- ============================================================================
CREATE TABLE app.users (
    id VARCHAR(50) PRIMARY KEY,                  -- 'AUTH001'..'AUTH010' or 'ADMIN001'
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,                 -- Secure password hash (bcrypt / argon2)
    role_id INT NOT NULL REFERENCES app.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    phone TEXT,                                  -- Author phone from dataset (NULL for admin)
    city TEXT,                                   -- Author city from dataset (NULL for admin)
    joined_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role_id ON app.users(role_id);

-- ============================================================================
-- 3. BOOKS TABLE
-- Accommodates published books and in-production books (BK013, BK015):
-- publication_date, mrp, author_royalty_per_copy and print_partner are NULL for those
-- Multi-column UNIQUE constraint (id, author_id) allows composite FK from tickets
-- Consistency check: royalty_paid + royalty_pending must equal total_royalty_earned
-- ============================================================================
CREATE TABLE app.books (
    id VARCHAR(50) PRIMARY KEY,                  -- 'BK001'..'BK018'
    author_id VARCHAR(50) NOT NULL REFERENCES app.users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    title TEXT NOT NULL,
    isbn TEXT UNIQUE,                            -- Nullable (PostgreSQL permits multiple NULLs in UNIQUE)
    genre TEXT,
    publication_date DATE,                       -- Nullable for books in production
    status TEXT NOT NULL,                        -- e.g. 'Published & Live', 'In Production - Cover Design'
    mrp NUMERIC(10, 2) CHECK (mrp IS NULL OR mrp >= 0),
    author_royalty_per_copy NUMERIC(10, 2) CHECK (author_royalty_per_copy IS NULL OR author_royalty_per_copy >= 0), -- NULL for in-production books
    total_copies_sold INT NOT NULL DEFAULT 0 CHECK (total_copies_sold >= 0),
    total_royalty_earned NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_royalty_earned >= 0),
    royalty_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (royalty_paid >= 0),
    royalty_pending NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (royalty_pending >= 0),
    last_royalty_payout_date DATE,               -- Nullable for zero-royalty books or in-production
    print_partner TEXT,                          -- 'In-House', 'Repro India', 'Epitome Books'
    available_on JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(available_on) = 'array'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_books_id_author UNIQUE (id, author_id),
    CONSTRAINT chk_books_royalty_sum CHECK (royalty_paid + royalty_pending = total_royalty_earned)
);

CREATE INDEX idx_books_author_id ON app.books(author_id);
CREATE INDEX idx_books_status ON app.books(status);

-- ============================================================================
-- 4. TICKETS TABLE
-- Composite foreign key (book_id, author_id) ensures selected book strictly belongs to author.
-- Uses ON DELETE RESTRICT for PostgreSQL 14 compatibility and to prevent orphaned relations.
-- Active category defaults to 'General Inquiry' (clean fallback for unclassified/manual tickets).
-- Active priority defaults to 'Medium'.
-- updated_at defaults to CURRENT_TIMESTAMP on creation and is updated by the API on edits.
-- ============================================================================
CREATE TABLE app.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number SERIAL UNIQUE,                 -- Sequential human-readable ticket number (#1, #2)
    author_id VARCHAR(50) NOT NULL REFERENCES app.users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    book_id VARCHAR(50),                         -- NULL for "General / Account Level" queries
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status app.ticket_status NOT NULL DEFAULT 'Open',
    
    -- Active category & priority (AI or Admin override)
    category app.ticket_category NOT NULL DEFAULT 'General Inquiry',
    priority app.ticket_priority NOT NULL DEFAULT 'Medium',
    
    -- AI-generated classifications & reasoning (preserved for auditing & comparison)
    ai_category app.ticket_category,
    ai_priority app.ticket_priority,
    ai_reasoning TEXT,
    
    assigned_to VARCHAR(50) REFERENCES app.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Composite foreign key guarantees book_id belongs to author_id
    CONSTRAINT fk_tickets_book_author FOREIGN KEY (book_id, author_id)
        REFERENCES app.books(id, author_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_tickets_author_id ON app.tickets(author_id);
CREATE INDEX idx_tickets_book_id ON app.tickets(book_id);
CREATE INDEX idx_tickets_status ON app.tickets(status);
CREATE INDEX idx_tickets_priority ON app.tickets(priority);
CREATE INDEX idx_tickets_category ON app.tickets(category);
CREATE INDEX idx_tickets_assigned_to ON app.tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON app.tickets(created_at DESC);
CREATE INDEX idx_tickets_updated_at ON app.tickets(updated_at DESC);

-- ============================================================================
-- 5. TICKET_RESPONSES TABLE (Conversation thread)
-- Visible to both Author and Admin. Captures two-way dialog.
-- Composite index (ticket_id, created_at ASC) optimizes chronological thread rendering.
-- ============================================================================
CREATE TABLE app.ticket_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES app.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sender_id VARCHAR(50) NOT NULL REFERENCES app.users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    body TEXT NOT NULL,
    is_ai_drafted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_responses_thread ON app.ticket_responses(ticket_id, created_at ASC);
CREATE INDEX idx_ticket_responses_sender_id ON app.ticket_responses(sender_id);

-- ============================================================================
-- 6. INTERNAL_NOTES TABLE (Admin private notes)
-- Strictly admin-facing; never exposed in author endpoints or response thread.
-- ============================================================================
CREATE TABLE app.internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES app.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE,
    admin_id VARCHAR(50) NOT NULL REFERENCES app.users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_internal_notes_ticket_id ON app.internal_notes(ticket_id);
CREATE INDEX idx_internal_notes_admin_id ON app.internal_notes(admin_id);

-- ============================================================================
-- 7. TICKET_DRAFTS TABLE (AI Draft Response Caching)
-- Caches generated AI response per ticket to prevent duplicate API calls and save tokens.
-- ticket_id is UNIQUE, providing automatic index coverage.
-- ============================================================================
CREATE TABLE app.ticket_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID UNIQUE NOT NULL REFERENCES app.tickets(id) ON UPDATE CASCADE ON DELETE CASCADE,
    draft_text TEXT NOT NULL,
    model_used TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. REQUEST_LOGS TABLE (API Observability & Audit Trail)
-- Captures request latency, methods, routes, status codes, sanitized payload, and caller.
-- Application middleware masks passwords, tokens, and PII before insertion.
-- ============================================================================
CREATE TABLE app.request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_method VARCHAR(10) NOT NULL,
    request_url TEXT NOT NULL,
    api_url TEXT,
    status_code INT CHECK (status_code IS NULL OR (status_code >= 100 AND status_code <= 599)),
    input JSONB,                                  -- Masked/sanitized parameters
    response JSONB,
    error TEXT,
    ip TEXT,
    user_agent TEXT,
    called_by VARCHAR(50) REFERENCES app.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    duration_ms NUMERIC(10, 2) CHECK (duration_ms IS NULL OR duration_ms >= 0),
    start_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_on TIMESTAMPTZ                      -- Populated upon completion
);

CREATE INDEX idx_request_logs_called_by ON app.request_logs(called_by);
CREATE INDEX idx_request_logs_status_code ON app.request_logs(status_code);
CREATE INDEX idx_request_logs_start_on ON app.request_logs(start_on DESC);

-- ============================================================================
-- 9. LLM_LOGS TABLE (AI Invocations, Token Usage, Latency & Fallbacks)
-- Observability for prompt engineering, token consumption, and graceful degradation.
-- PII and credentials are omitted by application prompt builders.
-- ============================================================================
CREATE TABLE app.llm_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES app.tickets(id) ON UPDATE CASCADE ON DELETE SET NULL,
    operation_type VARCHAR(50) NOT NULL,          -- 'classify_priority', 'draft_response'
    model_name TEXT NOT NULL,                     -- e.g. 'gemini-1.5-flash', 'gemini-2.0-flash'
    system_prompt TEXT,
    user_prompt TEXT NOT NULL,
    context_data JSONB,                           -- Injected KB section and relevant book snippet
    raw_response TEXT,
    parsed_response JSONB,
    prompt_tokens INT CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
    completion_tokens INT CHECK (completion_tokens IS NULL OR completion_tokens >= 0),
    total_tokens INT CHECK (total_tokens IS NULL OR total_tokens >= 0),
    latency_ms NUMERIC(10, 2) CHECK (latency_ms IS NULL OR latency_ms >= 0),
    status app.llm_log_status NOT NULL DEFAULT 'success',
    error_message TEXT,
    is_fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
    called_by VARCHAR(50) REFERENCES app.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_llm_logs_ticket_id ON app.llm_logs(ticket_id);
CREATE INDEX idx_llm_logs_operation ON app.llm_logs(operation_type);
CREATE INDEX idx_llm_logs_status ON app.llm_logs(status);
CREATE INDEX idx_llm_logs_created_at ON app.llm_logs(created_at DESC);
