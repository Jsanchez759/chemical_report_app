# admin

ChemOps Control: standalone admin panel (no build step).

## Features
- Dedicated login page (dashboard blocked until authenticated)
- Admin login against API (`/api/v1/auth/login`)
- List users (`/api/v1/admin/users`)
- List all reports (`/api/v1/admin/reports`)
- List reports by user (`/api/v1/admin/users/{user_id}/reports`)

## Run

From this folder:

```bash
cd apps/admin
python3 -m http.server 5173
```

Open:
- `http://127.0.0.1:5173`

Use API base URL input:
- default: `http://127.0.0.1:8000/api/v1`

Make sure your API is running and you log in with an `admin` user.
