-- Migration: Phase 2 + Phase 3
-- Run this ONCE against your existing database (schema.sql + seed.sql
-- must already be applied):
--
--   psql "$DATABASE_URL" -f src/db/migrations/002_phase2_phase3.sql

-- ─────────────────────────────────────────────────────────────
-- Phase 2: refresh tokens
-- We store only a SHA-256 hash of the token, never the raw
-- token — same principle as password hashing: if the table
-- leaks, the tokens inside it are useless to an attacker.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id  UUID NOT NULL REFERENCES identities(id),
    token_hash   TEXT NOT NULL UNIQUE,
    expires_at   TIMESTAMP NOT NULL,
    revoked_at   TIMESTAMP,
    created_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_identity ON refresh_tokens(identity_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ─────────────────────────────────────────────────────────────
-- Phase 3: soft delete for secrets
-- Deleted secrets are hidden from list/read but stay in the
-- table (and in audit_log) — matches how a real secrets manager
-- behaves: you can prove what a secret WAS, even after removal.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE secrets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ─────────────────────────────────────────────────────────────
-- New policies to support the rotate/update/delete/list actions
-- added in this phase. These are additive — nothing about the
-- original read policy (and its intentional admin-deny path)
-- changes.
-- ─────────────────────────────────────────────────────────────
INSERT INTO policies (role, resource_tag, action, effect)
SELECT 'admin', 'app-config', 'rotate', 'allow'
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE role = 'admin' AND resource_tag = 'app-config' AND action = 'rotate'
);

INSERT INTO policies (role, resource_tag, action, effect)
SELECT 'admin', 'app-config', 'update', 'allow'
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE role = 'admin' AND resource_tag = 'app-config' AND action = 'update'
);

INSERT INTO policies (role, resource_tag, action, effect)
SELECT 'admin', 'app-config', 'delete', 'allow'
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE role = 'admin' AND resource_tag = 'app-config' AND action = 'delete'
);
