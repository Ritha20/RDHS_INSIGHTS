from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),

    # Root redirects to admin panel (handled in indicators/views.py)
    path('', include('indicators.urls')),

    # Admin panel
    path('admin-panel/', include('indicators.admin_urls')),
]
