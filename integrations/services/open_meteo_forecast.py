"""
Integração com a Open-Meteo Forecast API (dados meteorológicos gerais).

Documentação: https://open-meteo.com/en/docs
Não requer chave de API.

A Marine API não traz vento nem pressão atmosférica — por isso essa
consulta é separada, mas ambas alimentam o mesmo dashboard.
"""

from datetime import datetime, timezone

from integrations.schemas import DataReading, unavailable_reading
from integrations.services.http_client import ExternalApiError, get_json

BASE_URL = "https://api.open-meteo.com/v1/forecast"

VARIABLES = {
    "wind_speed_10m": ("wind_speed_10m", "km/h"),
    "wind_direction_10m": ("wind_direction_10m", "°"),
    "pressure_msl": ("pressure_msl", "hPa"),
    "temperature_2m": ("temperature_2m", "°C"),
}


def fetch_weather_data(latitude: float, longitude: float) -> list[DataReading]:
    api_field_names = [field_name for field_name, _ in VARIABLES.values()]
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": ",".join(api_field_names),
        "timezone": "UTC",
    }

    try:
        data = get_json(BASE_URL, params)
    except ExternalApiError as exc:
        return [
            unavailable_reading("open-meteo-forecast", var, unit, latitude, longitude, exc.reason)
            for var, (_, unit) in VARIABLES.items()
        ]

    current = data.get("current", {})
    timestamp = current.get("time")
    if timestamp:
        timestamp = datetime.fromisoformat(timestamp).replace(tzinfo=timezone.utc).isoformat()

    readings = []
    for var, (api_field, unit) in VARIABLES.items():
        value = current.get(api_field)
        if value is None:
            readings.append(
                unavailable_reading(
                    "open-meteo-forecast", var, unit, latitude, longitude,
                    "variável não disponível para este ponto/momento",
                )
            )
        else:
            readings.append(
                DataReading(
                    source="open-meteo-forecast",
                    variable=var,
                    value=value,
                    unit=unit,
                    timestamp=timestamp,
                    latitude=latitude,
                    longitude=longitude,
                    status="ok",
                )
            )
    return readings
