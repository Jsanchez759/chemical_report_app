# chemical_report_app

Monorepo for chemical reports with a separate API, user frontend, and admin app.

## Repository Structure

```txt
apps/
  api/          # FastAPI backend (current working app)
  web/          # user-facing frontend (scaffold)
  admin/        # separate admin panel app (scaffold)
packages/
  shared-types/ # shared contracts/types between apps
  ui/           # shared UI components (optional)
infra/
  docker/       # containerization assets
  nginx/        # reverse proxy config
  scripts/      # infra/deploy scripts
docs/           # architecture and runbooks
```

## Run API

```bash
cd apps/api
uvicorn app.main:app --reload
```

API docs:
- `http://localhost:8000/docs`

## Next Steps

1. Scaffold `apps/web` (React/Next/Vite).
2. Scaffold `apps/admin` as a fully separate app with admin auth/roles.
3. Move shared API contracts to `packages/shared-types`.
