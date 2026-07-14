# VaultKey — Frontend

A minimal, professional dashboard for the VaultKey secrets management
API: sign in, browse and manage secrets, configure access policies,
manage identities, and read the audit ledger — all backed by the
real RBAC and envelope encryption on the server, not simulated here.

Built with React + Vite + React Router. No UI framework — a small
hand-built design system (see `src/styles/tokens.css`) themed around
the idea of a vault: warm dark ink instead of black, a brass accent
(the "key"), and verdigris/rust for allow/deny states instead of
generic green/red.

## Setup

```bash
npm install
cp .env.example .env
```

Set `VITE_API_URL` in `.env` to wherever your VaultKey backend is
running (defaults to `http://localhost:3000` if unset):

```
VITE_API_URL=http://localhost:3000
```

## Run it

```bash
npm run dev
```

Opens at `http://localhost:5173`. Log in with one of the seeded
identities from the backend (`admin` / `AdminPass123!` or
`backend-svc` / `ServicePass123!`), or a service one you've created.

## Build for production

```bash
npm run build
```

Outputs static files to `dist/` — deploy that folder anywhere that
serves static sites (Vercel, Netlify, Render static site, etc).
Remember to set `VITE_API_URL` as an environment variable in your
hosting provider pointing at your deployed backend, since `.env` is
baked in at build time, not read at runtime.

## What's here

- **Login** — signs in, stores a refresh token, restores the session
  silently on reload (decodes the access token client-side purely for
  display; every real authorization check still happens server-side).
- **Secrets** — list (metadata only, filtered to what your role can
  see), create, reveal (RBAC-checked and audited), update, rotate,
  soft-delete — plus a per-secret access ledger.
- **Policies** (admin) — list, create, delete allow/deny rules.
- **Identities** (admin) — list identities, create new ones with the
  same strong-password validation as the API.
- **Audit log** (admin) — the full access ledger, filterable by
  action and result.

Access tokens are held in memory only; refresh tokens live in
`localStorage` and rotate on every use, matching the backend's
one-time-use refresh token design. A 401 anywhere triggers exactly
one silent refresh-and-retry before giving up and returning to the
login screen.
