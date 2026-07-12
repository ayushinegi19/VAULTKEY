# VaultKey

A minimal, genuinely-working secrets management backend: envelope
encryption (AES-256-GCM), role-based access control, and append-only
audit logging, built on Node/Express and raw `pg` (no ORM).

## Architecture at a glance

- **Envelope encryption** — every secret gets its own random data
  key; the data key is what's used to encrypt the secret value, and
  the data key itself is then encrypted ("wrapped") with a single
  master key from the environment. See `src/services/encryptionService.js`
  for a fully commented walkthrough — it's written to be interview-ready.
- **RBAC** — `policies` rows map `(role, resource_tag, action) -> allow/deny`.
  No matching policy = deny (fail closed). An explicit deny always
  beats an allow. See `src/middleware/rbac.js`.
- **Audit logging** — every secret read is logged to `audit_log`,
  whether it was allowed or denied. See `src/services/auditService.js`.

## Setup (under 5 minutes)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate a real master key and put it in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Fill in `DATABASE_URL` for your local Postgres instance (e.g.
`postgres://postgres:postgres@localhost:5432/vaultkey`), and set
`JWT_SECRET` to any long random string.

### 3. Create the database and run the schema + seed

```bash
createdb vaultkey   # or create it however you normally would
psql "$DATABASE_URL" -f src/db/schema.sql
psql "$DATABASE_URL" -f src/db/seed.sql
```

The seed creates two identities you can log in with immediately:

| name          | password         | role    |
|---------------|-------------------|---------|
| `admin`       | `AdminPass123!`   | admin   |
| `backend-svc` | `ServicePass123!` | service |

It also seeds one policy: **`service` role can `read` secrets tagged
`app-config`**. Nothing else is allowed by default — that's the
fail-closed design, and it's on purpose so you can immediately see
both an allow and a deny.

### 4. Start the server

```bash
npm start
```

Server runs on `http://localhost:3000` by default (or whatever `PORT`
you set in `.env`).

## Try it with curl

**Log in as the service identity:**

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"backend-svc","credential":"ServicePass123!"}'
```

Copy the `token` from the response into `$SERVICE_TOKEN`:

```bash
export SERVICE_TOKEN="paste-the-token-here"
```

Also log in as admin (needed to create the secret, and to view the audit log):

```bash
export ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"admin","credential":"AdminPass123!"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

**Create a secret** (tag `app-config` matches the seeded policy):

```bash
curl -s -X POST http://localhost:3000/api/secrets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"db-password","tag":"app-config","value":"correct-horse-battery-staple"}'
```

Copy the returned `id` into `$SECRET_ID`, then **retrieve it as the
allowed identity**:

```bash
curl -s http://localhost:3000/api/secrets/$SECRET_ID \
  -H "Authorization: Bearer $SERVICE_TOKEN"
```

You should get back the decrypted plaintext value. Now **try the same
request as `admin`**, who has no read policy for `app-config`:

```bash
curl -s http://localhost:3000/api/secrets/$SECRET_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

You should get a `403`. Finally, **check the audit log** (admin-only)
and see both attempts recorded:

```bash
curl -s http://localhost:3000/api/audit \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Or just run the automated smoke test

With the server running in one terminal, run this in another:

```bash
npm test
```

This scripts through the exact same flow as the curl walkthrough
above — login, create, allowed read, denied read, audit check — and
asserts each step, so you get immediate proof the security logic
actually works end to end.

## API summary

| Method | Path                | Auth           | Description                          |
|--------|----------------------|----------------|---------------------------------------|
| POST   | `/api/identities`    | none           | Create an identity                    |
| POST   | `/api/auth/login`    | none           | Log in, get a JWT                     |
| POST   | `/api/secrets`       | JWT            | Create a secret (envelope-encrypted)  |
| GET    | `/api/secrets/:id`   | JWT + policy   | Read a secret (RBAC + audit logged)   |
| POST   | `/api/policies`      | JWT (admin)    | Create a policy                       |
| GET    | `/api/audit`         | JWT (admin)    | List audit log entries                |

## Notes for production hardening (not implemented here, on purpose)

This is a starter/portfolio codebase, so a few things are deliberately
left as notes rather than implemented:

- The app's DB role should be `REVOKE`d `UPDATE`/`DELETE` on
  `audit_log` — the exact statements are in `src/db/schema.sql`.
- `MASTER_KEY` living in an env var is fine for a portfolio project;
  in a real deployment you'd pull it from a proper KMS/HSM instead.
- Rate limiting, refresh tokens, and stricter password policy are all
  reasonable next additions but out of scope for this starter.
