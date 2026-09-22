"""
Integração com a Open-Meteo Marine API.

Documentação: https://open-meteo.com/en/docs/marine-weather-api
Não requer chave de API.
"""

from datetime import datetime, timezone

from integrations.schemas import DataReading, unavailable_reading
from integrations.services.http_client import ExternalApiError, get_json

BASE_URL = "https://marine-api.open-meteo.com/v1/marine"

# variável interna -> (nome no retorno da API, unidade)
VARIABLES = {
    "wave_height": ("wave_height", "m"),
    "wave_direction": ("wave_direction", "°"),
    "wave_period": ("wave_period", "s"),
    "swell_wave_height": ("swell_wave_height", "m"),
    "swell_wave_direction": ("swell_wave_direction", "°"),
    "swell_wave_period": ("swell_wave_period", "s"),
    "ocean_current_velocity": ("ocean_current_velocity", "km/h"),
    "ocean_current_direction": ("ocean_current_direction", "°"),
    "sea_surface_temperature": ("sea_surface_temperature", "°C"),
    "sea_level_height_msl": ("sea_level_height_msl", "m"),
}


def fetch_marine_data(latitude: float, longitude: float) -> list[DataReading]:
    """
    Consulta a Open-Meteo Marine API para o ponto informado e retorna uma
    lista de DataReading — uma por variável, com status individual.

    Nunca falha "tudo ou nada": se a API cair, cada variável é marcada
    como indisponível/erro, mas a estrutura de retorno é sempre a mesma.
    """
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
            unavailable_reading("open-meteo-marine", var, unit, latitude, longitude, exc.reason)
            for var, (_, unit) in VARIABLES.items()
        ]

    current = data.get("current", {})
    timestamp = current.get("time")
    if timestamp:
        # A API retorna hora local no timezone pedido (UTC); normaliza para ISO 8601.
        timestamp = datetime.fromisoformat(timestamp).replace(tzinfo=timezone.utc).isoformat()

    readings = []
    for var, (api_field, unit) in VARIABLES.items():
        value = current.get(api_field)
        if value is None:
            readings.append(
                unavailable_reading(
                    "open-meteo-marine", var, unit, latitude, longitude,
                    "variável não disponível para este ponto/momento (ex.: fora de cobertura marinha)",
                )
            )
        else:
            readings.append(
                DataReading(
                    source="open-meteo-marine",
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
