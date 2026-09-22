"""
Cliente HTTP genérico usado por todas as integrações.

Centraliza timeout e tratamento de erros (seção 17 do prompt base):
API indisponível, timeout, resposta vazia, erro HTTP — nada disso deve
vazar como exceção bruta para o usuário final.
"""

import logging

import requests

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 8  # segundos


class ExternalApiError(Exception):
    """Erro controlado ao consultar uma API externa. Sempre carrega um motivo legível."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


def get_json(url: str, params: dict, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """
    Executa um GET e retorna o JSON, ou levanta ExternalApiError com uma
    mensagem clara (nunca a exceção bruta do requests).

    `timeout` é configurável porque algumas chamadas (ex.: histórico
    horário de 30 dias para o preditor de maré) trazem muito mais dados
    que uma consulta simples e podem legitimamente levar mais que os 8s
    padrão.
    """
    try:
        response = requests.get(url, params=params, timeout=timeout)
    except requests.exceptions.Timeout as exc:
        logger.warning("Timeout ao consultar %s: %s", url, exc)
        raise ExternalApiError("timeout ao consultar a API externa") from exc
    except requests.exceptions.ConnectionError as exc:
        logger.warning("Falha de conexão ao consultar %s: %s", url, exc)
        raise ExternalApiError("API externa indisponível (falha de conexão)") from exc
    except requests.exceptions.RequestException as exc:
        logger.warning("Erro de requisição ao consultar %s: %s", url, exc)
        raise ExternalApiError("erro inesperado ao consultar a API externa") from exc

    if response.status_code == 429:
        raise ExternalApiError("limite de requisições da API externa atingido")
    if response.status_code >= 500:
        raise ExternalApiError(f"API externa retornou erro de servidor ({response.status_code})")
    if response.status_code >= 400:
        raise ExternalApiError(f"requisição inválida para a API externa ({response.status_code})")

    try:
        data = response.json()
    except ValueError as exc:
        raise ExternalApiError("resposta vazia ou inválida da API externa") from exc

    if not data:
        raise ExternalApiError("resposta vazia da API externa")

    return data
