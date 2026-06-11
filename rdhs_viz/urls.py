from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('indicators.urls')),
    path('admin-panel/', include('indicators.admin_urls')),
]
