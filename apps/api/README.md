# api

FastAPI backend for chemical report generation.

## Run

```bash
uvicorn app.main:app --reload
```

## Important Paths

- `app/` API modules (routes, schemas, services, models)
- `src/` report generation + utilities
- `generated_pdfs/` generated report files
- `test.db` local sqlite database
