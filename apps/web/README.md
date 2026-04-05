# web

ChemReport Studio: user-facing Vite + React frontend.

## Features
- Dedicated auth experience (Sign In / Create Account)
- Dashboard blocked until authentication
- Create new report
- List your previous reports
- Review full report data + metadata
- Open generated PDF

## Run

```bash
cd apps/web
npm install
npm run dev
```

Open:
- `http://127.0.0.1:5173`

Default API base URL:
- `http://127.0.0.1:8000/api/v1`

You can change API base URL directly in the auth page.
