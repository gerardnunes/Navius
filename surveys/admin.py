from django.contrib import admin

from surveys.models import Survey, SurveyPoint


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ("nome", "total_pontos", "total_pontos_invalidos", "profundidade_min", "profundidade_max", "criado_em")


@admin.register(SurveyPoint)
class SurveyPointAdmin(admin.ModelAdmin):
    list_display = ("survey", "ordem", "latitude", "longitude", "depth", "timestamp", "is_outlier")
    list_filter = ("survey", "is_outlier")
