-- VaultKey schema
-- Run this against a fresh Postgres database before seed.sql.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- identities: any principal that can authenticate (human admin,
-- backend service account, etc). "role" drives RBAC decisions.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identities (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT UNIQUE NOT NULL,
    hashed_credential TEXT NOT NULL,
    role              TEXT NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- policies: role -> (resource_tag, action) -> allow/deny.
-- A missing policy row means "deny" (fail closed). If both an
-- allow and a deny row match, deny wins (see rbac.js).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role          TEXT NOT NULL,
    resource_tag  TEXT NOT NULL,
    action        TEXT NOT NULL,
    effect        TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- secrets: only ever stores ciphertext. encrypted_value is the
-- secret encrypted under a per-secret data key (AES-256-GCM).
-- encrypted_data_key is that data key, itself encrypted under the
-- server's master key (this is the "envelope" in envelope
-- encryption). iv/auth_tag belong to the encrypted_value, not the
-- encrypted_data_key (the data-key's iv/tag are packed inside the
-- encrypted_data_key string itself — see encryptionService.js).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secrets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    tag                 TEXT NOT NULL,
    encrypted_value     TEXT NOT NULL,
    encrypted_data_key  TEXT NOT NULL,
    iv                  TEXT NOT NULL,
    auth_tag            TEXT NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- audit_log: append-only record of every access attempt, allowed
-- or denied. This table is the source of truth for "who touched
-- what, when, and were they allowed to."
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id  UUID REFERENCES identities(id),
    secret_id    UUID,
    action       TEXT NOT NULL,
    result       TEXT NOT NULL,
    timestamp    TIMESTAMP NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- Least-privilege note for real deployments:
--
-- The database role the application connects as should NEVER be
-- able to UPDATE or DELETE rows in audit_log — an attacker (or a
-- bug) that can rewrite audit history defeats the point of an
-- audit trail. In production you'd create a dedicated app role
-- and lock it down like this (adjust the role name to match your
-- actual deployment):
--
--   REVOKE UPDATE, DELETE ON audit_log FROM vaultkey_app;
--   GRANT  SELECT, INSERT ON audit_log TO vaultkey_app;
--
-- For local/dev use with a single Postgres user these REVOKEs are
-- commented out below (a single-role local setup can't revoke
-- privileges from itself), but keep them in mind — and apply them
-- — the moment you provision a dedicated application DB role.
--
-- REVOKE UPDATE, DELETE ON audit_log FROM vaultkey_app;
-- GRANT  SELECT, INSERT ON audit_log TO vaultkey_app;

CREATE INDEX IF NOT EXISTS idx_secrets_tag ON secrets(tag);
CREATE INDEX IF NOT EXISTS idx_policies_role_tag_action ON policies(role, resource_tag, action);
CREATE INDEX IF NOT EXISTS idx_audit_log_identity ON audit_log(identity_id);
-- VaultKey seed data
-- Run this AFTER schema.sql. Gives you two working identities and
-- one policy so the app is testable immediately.
--
-- Seeded logins (plaintext, for local testing only — never do this
-- in a real environment):
--   name: admin      password: AdminPass123!     role: admin
--   name: backend-svc password: ServicePass123!   role: service
--
-- The hashes below are real bcrypt hashes of the passwords above
-- (cost factor 10), generated with bcrypt.hashSync at seed-creation
-- time — not placeholders.

INSERT INTO identities (id, name, hashed_credential, role, created_at)
VALUES
  ('4cc26004-7022-4aeb-8979-a11ebbd7745b', 'admin', '$2b$10$U0.A68PbY99aclDmjfIDEu3FD4wkBgzA2frYRsnKTJVqmhNn2OekK', 'admin', now()),
  ('c1815a58-48cc-4f59-be8c-84dcbab0479d', 'backend-svc', '$2b$10$Wkmqg2tBZENbVy2jHx.HCu9BVM.m8yydPVTCbT9BlT/yMUNu4eIB6', 'service', now())
ON CONFLICT (name) DO NOTHING;

-- The "service" role is allowed to read secrets tagged "app-config".
-- Any other role/tag/action combination has no matching policy row
-- and is therefore denied by default (fail closed) — including the
-- "admin" role, which intentionally has no read policy seeded here,
-- so you can immediately observe both an allow and a deny in the
-- audit log (see tests/test.js and the README curl walkthrough).
INSERT INTO policies (id, role, resource_tag, action, effect, created_at)
VALUES
  ('bd4072cb-9751-4aed-a275-390902ac7911', 'service', 'app-config', 'read', 'allow', now())
ON CONFLICT (id) DO NOTHING;
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
