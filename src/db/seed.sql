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
