from django.http import JsonResponse
from django.shortcuts import render

from integrations.services.open_meteo_forecast import fetch_weather_data
from integrations.services.open_meteo_marine import fetch_marine_data


def index(request):
   
    return render(request, "dashboard/index.html")


def _validar_coordenadas(lat_raw, lon_raw):
 
    if lat_raw is None or lon_raw is None:
        return None, None, "Latitude e longitude são obrigatórias."
    try:
        lat = float(lat_raw)
        lon = float(lon_raw)
    except (TypeError, ValueError):
        return None, None, "Latitude e longitude devem ser números válidos."

    if not (-90 <= lat <= 90):
        return None, None, "Latitude deve estar entre -90 e 90."
    if not (-180 <= lon <= 180):
        return None, None, "Longitude deve estar entre -180 e 180."

    return lat, lon, None


def analyze_location(request):
   
    lat, lon, erro = _validar_coordenadas(request.GET.get("lat"), request.GET.get("lon"))
    if erro:
        return JsonResponse({"ok": False, "error": erro}, status=400)

    marine_readings = fetch_marine_data(lat, lon)
    weather_readings = fetch_weather_data(lat, lon)

    all_readings = [r.to_dict() for r in marine_readings + weather_readings]

    return JsonResponse(
        {
            "ok": True,
            "latitude": lat,
            "longitude": lon,
            "readings": all_readings,
        }
    )
