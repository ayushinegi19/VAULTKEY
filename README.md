# VaultKey

A secrets management system: envelope encryption, RBAC, audit
logging, refresh-token auth, and a dashboard to manage all of it.

This repo has two independent projects, each deployed separately:

```
VAULTKEY/
├── backend/     Node/Express API — deploy to Render
└── frontend/    React/Vite dashboard — deploy to Vercel
```

See each folder's own `README.md` for its specific setup steps.
Quick start for local development:

```bash
# Terminal 1 — backend
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, MASTER_KEY
npm start

# Terminal 2 — frontend
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL=http://localhost:3000
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at
`http://localhost:3000`.

## Deployment

- **Backend → Render**: set the service's Root Directory to `backend`,
  build command `npm install`, start command `npm start`. Add
  `DATABASE_URL`, `JWT_SECRET`, `MASTER_KEY` as environment variables.
- **Frontend → Vercel**: set the project's Root Directory to
  `frontend`. Vercel auto-detects the Vite build. Add `VITE_API_URL`
  pointing at your deployed Render URL as an environment variable
  before the first build.
