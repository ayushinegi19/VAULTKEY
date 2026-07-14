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
