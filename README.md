# ChemReport Studio

A workspace for creating chemical reports, reading them later, exporting PDFs, and asking questions about a saved report. The repository also includes a separate administration app.

## Apps

- `apps/api` — FastAPI backend, authentication, report generation, chat, and PDF output.
- `apps/web` — React user workspace.
- `apps/admin` — administrator workspace for users and reports.

## API and model access

The standard OpenRouter inference key belongs on the **API server**. Do not use an OpenRouter Management API key for chat completions. Set `LLM_API_KEY`, `LLM_MODEL=openrouter/free`, and `OPENAI_BASE_URL=https://openrouter.ai/api/v1` in the API environment (see `apps/api/.env.example`). Never put the provider key in a `VITE_*` variable or the frontend bundle. Users sign in with a ChemReport account; they are not asked for a model key.

Report generation requires an authenticated user and is limited to 3 requests per minute and 20 per day, per account. Report chat is limited to 10 requests per minute and 100 per day, per account. Prompts are limited to 4,000 characters and report chat messages to 1,200 characters to bound requests sent to the model.

For deployment, configure the same API environment variables in your backend host's secret settings. Keep `SECRET_KEY` private and unique to that environment.

## Local development

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set the server environment values in .env.
uvicorn app.main:app --reload
```

```bash
cd apps/web
npm ci
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 npm run dev
```

```bash
cd apps/admin
npm ci
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 npm run dev
```

The API docs are at `http://127.0.0.1:8000/docs`. The user app uses port 5173 and the admin app uses port 5174 by default. Without `VITE_API_BASE_URL`, both frontends use the hosted ChemReport API.

## Checks

```bash
cd apps/web && npm run build
cd ../admin && npm run build
```
