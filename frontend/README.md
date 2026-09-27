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
| `VITE_USE_MOCK=false` | Calls the FastAPI backend through `/api` (see below). If a request fails, that screen falls back to the mock file so the demo keeps working. |

Copy `.env.example` to `.env` to change these. Restart `npm run dev` after editing `.env`.

### Connecting to the backend

The app sends requests to `/api/...`, and the Vite dev server (`npm run dev`) and `npm run preview` forward them to the backend at `BACKEND_URL` (default `http://localhost:8000`). The browser only talks to one address, so the backend does not need CORS settings for local development or the demo laptop.

1. Start Junia's backend on port 8000.
2. In `frontend/.env`, set `VITE_USE_MOCK=false`.
3. Restart `npm run dev`.

## Endpoints the frontend calls

Reads take `?user=<id>` (the fictional demo user is `demo-user-1`). The mock files in `src/mocks/` are the proposed contract.

| Method | Path | Mock file / body |
|---|---|---|
| GET | `/risk` | `risk.json`: `user_id`, `prediction_for`, `risk_score` (0–1, shown as an experimental demo score), `risk_level` (`low`, `elevated` or `high`), `top_factors` as `{ name, direction, strength }` plus optional `value` and `unit`, `recommendation` (text), `explanation`, `days_logged`, `data_mode`, `model_status` |
| GET | `/triggers` | `triggers.json` |
| GET | `/environment` | `environment.json`: `fetched_at`, `valid_for`, `is_stale`, `sources`, `current` conditions (pollen is synthetic, 0–5), plus illustrative map `zones` |
| GET | `/log` | `log.json`: history, streak, rolling accuracy |
| GET | `/summary` | `summary.json`: weekly Gemini summary |
| POST | `/log` | Today's check-in: `{ user, date, puffs, pre_exercise_puffs, symptoms: {breath, wheeze, cough}, night_waking, emergency_signs }`. `puffs` is the day's total and includes `pre_exercise_puffs`. Saving the same user and date again should update that day, not add a new one. |
| POST | `/feedback` | `{ user, date, predicted_risk, had_flare_up }` |
| POST | `/profile` | `{ user, nickname, city, companion_name, survey, baseline_estimate }` |

`/environment` can also use the backend's nested format (`weather`, `air_quality`, `pollen` objects, as in `contracts/environment.json` on the Backend branch). `normalizeEnvironment` in `src/api.js` converts it; fields not sent yet, such as `aqi` or `pressure_change_24h`, show as "Not available". Map zones stay a frontend illustrative overlay until the backend sends `zones`.

The frontend only shows a save as successful when the POST returns a 2xx response. Requests time out after 8 seconds.

## Trigger alerts

`src/alerts.js` cautions the user when one of their triggers is high near them today, for example high synthetic pollen for someone whose predictions pollen strongly influences. It combines:

- **The model's trigger profile** (`triggers.json`: `feature`, `strength`, `discovered`). Strong triggers alert on moderate or high conditions; moderate triggers on high only; weak ones never. Emily: keep the `feature` names `pollen`, `air_quality`, `pressure_drop`, `humidity` and `cold_air`.
- **Today's conditions** (`environment.json` `current`). Thresholds are in `CONDITION_ALERTS` in `src/config.js`.

If a check-in logs symptoms while a trigger is high, the alert says so. Each alert shows at most once a day, as a banner on the map and, if the user allows it, as a system notification. System notifications only work while the app is open or in a background tab; alerts with the app closed would need the backend to send push messages.

## Install it on a phone (PWA)

Breezy is an installable web app: it has a name, icon and full-screen mode, and a service worker caches the app (and map tiles you've viewed) so it opens instantly and works offline. `/api` health data is never cached.

Phones only install apps served over **https**, so host the built app first. The simplest is Vercel's command line, run from `frontend/`:

```
npx vercel          # first time: sign in and accept the detected Vite settings
npx vercel --prod   # publish; prints the https address
```

Then open that address on a phone:

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).

The hosted app runs in mock mode unless it has a public backend address. The service worker only runs in production builds (`npm run build` / `npm run preview`), not in `npm run dev`.
