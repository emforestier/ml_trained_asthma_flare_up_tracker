from datetime import datetime, timezone

import requests


CITY = "Gainesville, FL"
LATITUDE = 29.6516
LONGITUDE = -82.3248
TIMEZONE = "America/New_York"


def fetch_environment():
    # Ask Open-Meteo for weather conditions.
    weather_response = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "timezone": TIMEZONE,
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
            "current": (
                "temperature_2m,"
                "relative_humidity_2m,"
                "pressure_msl,"
                "wind_speed_10m,"
                "rain"
            ),
        },
        timeout=3,
    )
    weather_response.raise_for_status()
    weather_data = weather_response.json()
    weather = weather_data["current"]

    # Ask Open-Meteo for air-quality conditions.
    air_response = requests.get(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        params={
            "latitude": LATITUDE,
            "longitude": LONGITUDE,
            "timezone": TIMEZONE,
            "current": "us_aqi,pm2_5,ozone",
        },
        timeout=3,
    )
    air_response.raise_for_status()
    air_data = air_response.json()
    air = air_data["current"]

    # Translate the results into the frontend's agreed format.
    return {
        "city": CITY,
        "lat": LATITUDE,
        "lon": LONGITUDE,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "valid_for": weather["time"].split("T")[0],
        "timezone": TIMEZONE,
        "weather_time": weather["time"],
        "air_quality_time": air["time"],
        "is_stale": False,
        "data_mode": "mixed",
        "sources": {
            "weather": "Open-Meteo modeled conditions",
            "air_quality": "Open-Meteo / CAMS modeled air quality",
            "pollen": "Synthetic demo data (0–5 scale)",
        },
        "current": {
            "temperature_c": weather.get("temperature_2m"),
            "humidity": weather.get("relative_humidity_2m"),
            "pressure_hpa": weather.get("pressure_msl"),
            "pressure_change_24h": None,
            "wind_kph": weather.get("wind_speed_10m"),
            "rain_mm": weather.get("rain"),
            "aqi": air.get("us_aqi"),
            "pm25": air.get("pm2_5"),
            "ozone": air.get("ozone"),
            "pollen": {
                "tree": 4.2,
                "grass": 2.1,
                "weed": 1.3,
            },
        },
        "units": {
            "temperature_c": "Celsius",
            "humidity": "%",
            "pressure_hpa": "hPa",
            "wind_kph": "km/h",
            "rain_mm": "mm over the weather interval",
            "aqi": "US AQI",
            "pm25": "micrograms per cubic meter",
            "ozone": "micrograms per cubic meter",
            "pollen": "internal demo scale from 0 to 5",
        },
        "weather_interval_seconds": weather.get("interval"),
        "zones_note": "No live neighborhood zones are provided.",
        "zones": [],
        "forecast": [],
    }
