# admin

ChemOps Control admin panel (Vite build).

## Features
- Dedicated login page (dashboard blocked until authenticated)
- Admin login against API (`/api/v1/auth/login`)
- List users (`/api/v1/admin/users`)
- List all reports (`/api/v1/admin/reports`)
- List reports by user (`/api/v1/admin/users/{user_id}/reports`)

## Local Run

```bash
cd apps/admin
npm install
npm run dev
```

Open:
- `http://127.0.0.1:5174`

Use API base URL input:
- default: `http://127.0.0.1:8000/api/v1`

## Build

```bash
cd apps/admin
npm run build
```

Output directory: `apps/admin/dist`

## Cloudflare Pages

- Framework preset: `Vite`
- Root directory: `apps/admin`
- Build command: `npm run build`
- Build output directory: `dist`

Make sure your API is running and you log in with an `admin` user.
