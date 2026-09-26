from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/environment")
def get_environment():
    return {
        "city": "Demo city",
        "date": "2026-09-26",
        "data_mode": "mock",
        "weather": {
            "temperature_c": 24,
            "humidity_percent": 60,
            "pressure_hpa": 1012,
            "wind_speed_kmh": 12,
            "rain_mm": 0,
            "source": "sample data",
            "is_synthetic": True
        },
        "air_quality": {
            "pm2_5": 12,
            "unit": "micrograms per cubic meter",
            "source": "sample data",
            "is_synthetic": True
        },
        "pollen": {
            "tree": 2,
            "grass": 4,
            "weed": 1,
            "scale": "0 to 5 internal demo scale",
            "source": "synthetic demo data",
            "is_synthetic": True
        }
    }