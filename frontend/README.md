# Frontend (Alexis)

React + Vite app for the asthma flare-up companion. Mobile-first; open it at phone width.

## Run it

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The design reference (companion moods and palette) is at http://localhost:5173/#/design.

## Mock switch

All data goes through `src/api.js`. Screens never call `fetch` themselves.

| `.env` setting | What happens |
|---|---|
| `VITE_USE_MOCK=true` (default) | Reads the JSON files in `src/mocks/`. A purple "Mock data" tag shows in the corner. |
| `VITE_USE_MOCK=false` | Calls the FastAPI backend at `VITE_API_URL`. If a request fails, that screen falls back to the mock file so the demo keeps working. |

Copy `.env.example` to `.env` to change these. Restart `npm run dev` after editing `.env`.

## Endpoints the frontend calls

Reads take `?user=<id>` (the demo user is `demo`). The mock files in `src/mocks/` are the proposed contract.

| Method | Path | Mock file / body |
|---|---|---|
| GET | `/risk` | `risk.json`: `risk_score`, `risk_level`, `top_factors`, `recommendation`, `explanation`, `learning` |
| GET | `/triggers` | `triggers.json` |
| GET | `/environment` | `environment.json`: `current` conditions plus map `zones` |
| GET | `/log` | `log.json`: history, streak, rolling accuracy |
| GET | `/summary` | `summary.json`: weekly Gemini summary |
| POST | `/log` | Today's check-in: `{ user, date, puffs, pre_exercise_puffs, symptoms: {breath, wheeze, cough}, night_waking, emergency_signs }` |
| POST | `/feedback` | `{ user, date, predicted_risk, had_flare_up }` |
| POST | `/profile` | `{ user, companion_name, survey, baseline_estimate }` |

The backend needs CORS enabled for `http://localhost:5173`.
