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

The backend needs CORS enabled for `http://localhost:5173`.

The frontend only shows a save as successful when the POST returns a 2xx response. Requests time out after 8 seconds.

## Trigger alerts

`src/alerts.js` cautions the user when one of their triggers is high near them today, for example high synthetic pollen for someone whose predictions pollen strongly influences. It combines:

- **The model's trigger profile** (`triggers.json`: `feature`, `strength`, `discovered`). Strong triggers alert on moderate or high conditions; moderate triggers on high only; weak ones never. Emily: keep the `feature` names `pollen`, `air_quality`, `pressure_drop`, `humidity` and `cold_air`.
- **Today's conditions** (`environment.json` `current`). Thresholds are in `CONDITION_ALERTS` in `src/config.js`.
- **Reported triggers** from onboarding, used instead of the model until the user has 14 days of check-ins.

If a check-in logs symptoms while a trigger is high, the alert says so. Each alert shows at most once a day, as a banner on the map and, if the user allows it, as a system notification. System notifications only work while the app is open or in a background tab; alerts with the app closed would need the backend to send push messages.
