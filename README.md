# Breezy - AI-Powered Asthma Risk Detector, Built on a Trained Regression Model
A companion app that helps people with asthma understand their personal risk of a flare-up **tomorrow** — before it happens — and gives them one clear, simple action to take.

> ⚠️ **This is a risk-awareness tool, not a diagnostic device.** It doesn't replace advice from a doctor, and it doesn't detect an asthma attack in progress. If you're experiencing severe breathlessness, blue or gray lips, or your rescue inhaler isn't helping, seek urgent medical care immediately.

---

## What this app does

Every day, the app looks at:
- The local weather, air quality, and pollen levels
- How the person has been using their rescue inhaler recently
- How their symptoms have felt (breathing, wheezing, coughing, night waking)

...and turns that into a simple risk score for tomorrow — **low, moderate, or high** — along with the top 2–3 things driving that risk (like "pollen" or "a pressure drop") and one plain-language recommendation.

Over time, the app also learns each person's own personal asthma triggers — because pollen might be someone's biggest trigger, while for someone else it's air quality or weather changes. That personalized "trigger profile" is the heart of the app.

## How it works, in plain terms

1. **We gather information** — real weather and air quality data, plus daily symptom check-ins and inhaler use.
2. **A prediction model looks for patterns** — using a machine learning model (LightGBM, with a simpler baseline model for comparison) trained to spot the combinations of conditions that tend to come before a flare-up.
3. **The model explains itself** — instead of just giving a number, it also says *why* ("your top triggers: pollen (strong), pressure drops (moderate)"), using a technique called SHAP that shows which factors mattered most for that specific prediction.
4. **The app puts it in front of the user** — as a friendly, mobile-style dashboard with a risk percentage, an explanation, one recommendation, and a daily check-in.

## Important honesty note about the data

Real weather and air quality data come from [Open-Meteo](https://open-meteo.com/), a free public source. **Pollen levels, inhaler use, and symptom logs used to train the model are simulated (synthetic)** — built using published asthma research as a guide, and calibrated to match real seasonal pollen patterns for our demo city, Gainesville, FL. We did this because there's no free, reliable source of a real patient's day-to-day rescue inhaler history to train on.

This means the model has learned patterns from realistic *simulated* behavior, not real patient outcomes. A production version of this app would need to validate and retrain on real, consented patient data before being used for actual health decisions.

## What the model can currently do

- Predicts next-day flare-up risk as a percentage
- Explains its prediction with the top contributing factors, ranked by strength (strong / moderate / weak)
- Adjusts its risk threshold to prioritize *catching real flare-ups* over avoiding false alarms, since missing a real flare-up is worse than one extra warning
- On our test data: correctly caught roughly 4 out of 5 real flare-up days, with similar accuracy on its warnings (numbers on synthetic data — see caveat above)

## Project structure

```
frontend/     → the React app (screens, map, companion character, animations)
model/        → data collection, synthetic data, model training, and prediction logic
backend/      → the API server that connects the model to the app, plus live data and storage
```

Each teammate works on their own folder and branch, and the three come together for the live demo.

## The team

| Person | Focus | What they built |
|---|---|---|
| **Alexis** | Frontend | The React app — every screen, the map, the companion character, animations |
| **Emily** | Data & Model | Historical + synthetic training data, feature engineering, the prediction model, explanations, and the `predict()` function |
| **Junia** | Backend | The live API, database, natural-language explanations, and connecting everything together |

## Tech used

- **Model:** LightGBM (with a logistic regression baseline for comparison), trained in Google Colab
- **Explanations:** SHAP for identifying top contributing factors; Gemini turns those into friendly, plain-language summaries
- **Frontend:** React
- **Backend:** FastAPI
- **Storage:** MongoDB Atlas
- **Data sources:** Open-Meteo (weather & air quality, real); synthetic pollen calibrated to CDC seasonal data; synthetic inhaler/symptom logs based on published asthma research

## Where this could go next

- Connect a live pollen data source for real-time accuracy
- Train and validate on real (consented, anonymized) patient data instead of simulated logs
- Expand to multiple cities and multiple real users, each with their own learned trigger profile

---

*Built for a hackathon. Not a substitute for medical advice — always follow guidance from a healthcare provider.*
