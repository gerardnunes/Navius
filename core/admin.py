from django.contrib import admin

from core.models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "organizacao", "cargo", "criado_em")
    search_fields = ("user__username", "user__email", "organizacao")
