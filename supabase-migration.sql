-- LearnTube AI Readiness MCP — Supabase Schema
-- Run this in your Supabase SQL editor

-- ─── SAVES (Knowledge Graph Nodes) ───────────────────────

CREATE TABLE IF NOT EXISTS saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  insight TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  domain TEXT,
  context TEXT,
  confidence_score INTEGER DEFAULT 3 CHECK (confidence_score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saves_user_id ON saves(user_id);
CREATE INDEX idx_saves_tags ON saves USING GIN(tags);
CREATE INDEX idx_saves_domain ON saves(domain);
CREATE INDEX idx_saves_user_created ON saves(user_id, created_at DESC);

-- ─── EDGES (Knowledge Graph Connections) ─────────────────

CREATE TABLE IF NOT EXISTS edges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_save_id UUID REFERENCES saves(id) ON DELETE CASCADE,
  to_save_id UUID REFERENCES saves(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'tag_overlap',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_save_id, to_save_id, relationship_type)
);

CREATE INDEX idx_edges_from ON edges(from_save_id);
CREATE INDEX idx_edges_to ON edges(to_save_id);

-- ─── USER SCORES ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_scores (
  user_id TEXT PRIMARY KEY,
  tier TEXT DEFAULT 'Explorer',
  level INTEGER DEFAULT 0 CHECK (level BETWEEN 0 AND 6),
  abilities JSONB DEFAULT '{}',
  streak_days INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ,
  total_saves INTEGER DEFAULT 0,
  total_elevates INTEGER DEFAULT 0,
  total_proves INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ELEVATE RESULTS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS elevate_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_description TEXT,
  domain TEXT,
  level_estimate INTEGER CHECK (level_estimate BETWEEN 0 AND 6),
  ability_scores JSONB DEFAULT '{}',
  what_did_well TEXT,
  what_missed TEXT,
  level_up_move TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_elevate_user ON elevate_results(user_id);
CREATE INDEX idx_elevate_user_created ON elevate_results(user_id, created_at DESC);

-- ─── PROVE RESULTS (Spot the Flaw) ──────────────────────

CREATE TABLE IF NOT EXISTS prove_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge_type TEXT NOT NULL,
  challenge_domain TEXT,
  user_choice TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  user_confidence INTEGER CHECK (user_confidence BETWEEN 1 AND 5),
  reasoning_quality TEXT DEFAULT 'no_reasoning',
  calibration_gap INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prove_user ON prove_results(user_id);
CREATE INDEX idx_prove_user_created ON prove_results(user_id, created_at DESC);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────
-- Phase 0: Using service key, so RLS is bypassed.
-- Phase 1: Enable RLS and add policies per user auth.

-- ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_scores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE elevate_results ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prove_results ENABLE ROW LEVEL SECURITY;
