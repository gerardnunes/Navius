

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class DataReading:
    source: str
    variable: str
    value: Optional[float]
    unit: str
    timestamp: Optional[str]
    latitude: float
    longitude: float
    status: str  # "ok" | "unavailable" | "error" | "timeout"
    message: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "variable": self.variable,
            "value": self.value,
            "unit": self.unit,
            "timestamp": self.timestamp,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "status": self.status,
            "message": self.message,
        }


def unavailable_reading(source: str, variable: str, unit: str, lat: float, lon: float, message: str) -> DataReading:
  
    return DataReading(
        source=source,
        variable=variable,
        value=None,
        unit=unit,
        timestamp=None,
        latitude=lat,
        longitude=lon,
        status="unavailable",
        message=message,
    )
