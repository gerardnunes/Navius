"""
Leitura de arquivos NetCDF (.nc) e GRIB (.grib/.grib2) — formatos comuns
de dados do Copernicus Marine e GEBCO (seção 4 do prompt base: preparar
integração futura, sem fingir suporte que não existe de verdade).

NetCDF: funciona via `xarray` + `netCDF4`, ambos instaláveis via pip
normalmente, sem dependência de sistema.

GRIB: `xarray` usa o engine `cfgrib`, que por sua vez depende da
biblioteca C ecCodes (não é um pacote Python puro). Se ecCodes não
estiver instalado no sistema, a abertura do arquivo falha com um erro
claro — nunca finja que funcionou.

Uso típico: o usuário baixa manualmente um recorte do Copernicus Marine
(processo de download deles, fora do escopo de automação aqui — exigiria
credenciais/API própria do Copernicus, não implementada) e faz upload do
arquivo `.nc`/`.grib` para extrair a série no ponto do levantamento.
"""

from dataclasses import dataclass

import numpy as np
import xarray as xr


class GeoFileReadError(Exception):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


@dataclass
class GeoFilePointSeries:
    variable: str
    unit: str
    latitude_usada: float
    longitude_usada: float
    tempos: list       # lista de timestamps (str ISO ou rótulo do eixo temporal do arquivo)
    valores: list       # lista de floats, mesmo tamanho de `tempos`


def _abrir_dataset(caminho_arquivo: str, engine: str = None):
    try:
        return xr.open_dataset(caminho_arquivo, engine=engine)
    except FileNotFoundError as exc:
        raise GeoFileReadError(f"arquivo não encontrado: {caminho_arquivo}") from exc
    except ValueError as exc:
        raise GeoFileReadError(
            f"não foi possível abrir o arquivo com engine='{engine}'. "
            f"Se for .grib e o erro mencionar 'cfgrib' ou 'eccodes', a "
            f"biblioteca C ecCodes provavelmente não está instalada no "
            f"sistema (não é resolvido via pip). Detalhe original: {exc}"
        ) from exc
    except Exception as exc:  # engines externos levantam tipos variados
        raise GeoFileReadError(f"falha ao abrir o arquivo: {exc}") from exc


def _nomes_coordenadas(ds) -> tuple:
    """Tenta descobrir os nomes de lat/lon/tempo, que variam entre datasets."""
    candidatos_lat = ["latitude", "lat", "y"]
    candidatos_lon = ["longitude", "lon", "x"]
    candidatos_tempo = ["time", "valid_time", "forecast_time"]

    lat_nome = next((c for c in candidatos_lat if c in ds.coords), None)
    lon_nome = next((c for c in candidatos_lon if c in ds.coords), None)
    tempo_nome = next((c for c in candidatos_tempo if c in ds.coords), None)

    if not lat_nome or not lon_nome:
        raise GeoFileReadError(
            f"não foi possível identificar as coordenadas de latitude/longitude "
            f"no arquivo. Coordenadas encontradas: {list(ds.coords)}"
        )
    return lat_nome, lon_nome, tempo_nome


def extrair_serie_no_ponto(caminho_arquivo: str, variavel: str, latitude: float, longitude: float,
                            formato: str = "netcdf") -> GeoFilePointSeries:
    """
    Abre um arquivo NetCDF ou GRIB e extrai a série temporal da variável
    pedida no ponto de grade mais próximo de (latitude, longitude).

    formato: "netcdf" (engine padrão do xarray) ou "grib" (engine cfgrib).
    """
    engine = "cfgrib" if formato == "grib" else None
    ds = _abrir_dataset(caminho_arquivo, engine=engine)

    try:
        if variavel not in ds.data_vars:
            raise GeoFileReadError(
                f"variável '{variavel}' não encontrada no arquivo. "
                f"Disponíveis: {list(ds.data_vars)}"
            )

        lat_nome, lon_nome, tempo_nome = _nomes_coordenadas(ds)

        ponto = ds.sel({lat_nome: latitude, lon_nome: longitude}, method="nearest")
        lat_usada = float(ponto[lat_nome].values)
        lon_usada = float(ponto[lon_nome].values)

        serie_da_variavel = ponto[variavel]
        unidade = serie_da_variavel.attrs.get("units", "desconhecida")

        if tempo_nome and tempo_nome in serie_da_variavel.dims:
            tempos = [str(t) for t in serie_da_variavel[tempo_nome].values]
            valores = [float(v) for v in np.atleast_1d(serie_da_variavel.values)]
        else:
            tempos = ["único"]
            valores = [float(serie_da_variavel.values)]

        return GeoFilePointSeries(
            variable=variavel, unit=str(unidade),
            latitude_usada=lat_usada, longitude_usada=lon_usada,
            tempos=tempos, valores=valores,
        )
    finally:
        ds.close()


def listar_variaveis(caminho_arquivo: str, formato: str = "netcdf") -> list:
    """Lista as variáveis disponíveis no arquivo, para o usuário escolher antes de extrair."""
    engine = "cfgrib" if formato == "grib" else None
    ds = _abrir_dataset(caminho_arquivo, engine=engine)
    try:
        return [
            {"nome": nome, "unidade": var.attrs.get("units", "desconhecida"), "dimensoes": list(var.dims)}
            for nome, var in ds.data_vars.items()
        ]
    finally:
        ds.close()
