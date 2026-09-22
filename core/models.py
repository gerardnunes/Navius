"""
Perfil estendido do usuário (seção 6: core = configurações e
funcionalidades compartilhadas).

Não guarda nada sensível — só contexto profissional do usuário no
sistema. Autenticação/senha continuam 100% no django.contrib.auth.User.
"""

from django.conf import settings
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    organizacao = models.CharField(max_length=200, blank=True)
    cargo = models.CharField(max_length=200, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Perfil de {self.user.username}"
