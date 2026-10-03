# web

ChemReport Studio: user-facing Vite + React frontend.

## Features
- Dedicated auth experience (Sign In / Create Account)
- Dashboard blocked until authentication
- Create new report
- List your previous reports
- Review full report data + metadata
- Open generated PDF
- Ask follow-up questions about a saved report
- Search reports by title or compound

## Run

```bash
cd apps/web
npm install
npm run dev
```

Open:
- `http://127.0.0.1:5173`

For local API development, run `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 npm run dev`. Otherwise the app uses the hosted API. The model provider key is configured only on the backend.
