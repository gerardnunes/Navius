from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("surveys/", include("surveys.urls")),
    path("oceanography/", include("oceanography.urls")),
    path("accounts/", include("core.urls")),
    path("", include("dashboard.urls")),
]
