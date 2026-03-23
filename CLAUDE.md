# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

```
backend/    FastAPI app (Python)
frontend/   Vite + React app
```

## Commands

### Backend
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload   # runs on :8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # runs on :5173, proxies all API routes → :8000
npm run build
```

## Architecture

**Backend** (`backend/main.py`) delegates storage to `database.py` (SQLite, `journal.db` auto-created). Tasting entries are `TastingEntry` Pydantic models (`models.py`). CORS is `allow_origins=["*"]`. `aromas` is stored as a JSON string and deserialised on read.

All AI endpoints call Anthropic (`claude-haiku-4-5-20251001`) and require `ANTHROPIC_API_KEY` in the environment:
- `GET /lookup` — wine origin/grapes lookup
- `GET /detect` — suggested aromas + structure profile
- `POST /pairings` — streaming food pairings for a wine
- `POST /scan-label` — vision: extract wine info from bottle label image (base64)
- `POST /scan-menu` — vision: extract food items from menu image (base64)
- `POST /scan-wine-menu` — vision: extract wine names from wine list image (base64)
- `POST /menu-pairings` — streaming: recommend wines from a list for selected foods
- `POST /food-pairings` — streaming: recommend wine styles for selected foods
- `POST /wine-food-pairings` — streaming: suggest food pairings for wines on a list

**Frontend** state lives in React component state. `TastingForm` manages its own form state, supports scanning a bottle label photo to auto-fill fields (`/scan-label`), and posts to `/tastings`. `WinePairing` offers two modes: "Scan Menus" (scan food menu + wine list images, select foods, get recommendations from the scanned wine list) and "Browse by Food" (category-based food selector, recommends wine styles).

Vite's dev proxy (`vite.config.js`) forwards all API routes to `:8000`, so the frontend never hard-codes the API host.

## Deployment

- **Backend**: Railway — `backend/Procfile` runs `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Frontend**: Netlify — `frontend/netlify.toml` defines the build (`npm run build` → `dist`) and redirects all API routes to the Railway URL. Replace `YOUR_BACKEND_URL` in `netlify.toml` with the actual Railway URL before deploying.
- Streaming endpoints (`/pairings`, `/menu-pairings`, `/food-pairings`) do not stream through Netlify's redirect proxy — the full response arrives at once.

## Data model

`TastingEntry` fields: `wine_name`, `producer`, `vintage`, `color` (red/white/rosé/orange/sparkling), `aromas` (string array), `acidity`/`tannin`/`body`/`alcohol`/`rating` (int 1–5), `notes`, `tasted_on`.
