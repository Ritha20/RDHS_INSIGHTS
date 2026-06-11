from django.shortcuts import redirect
from django.urls import reverse
from django.contrib import messages

class AdminAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/admin-panel/'):
            # Allow everyone to access login and logout
            if request.path.startswith('/admin-panel/login/') or request.path.startswith('/admin-panel/logout/'):
                return self.get_response(request)

            # If not authenticated, redirect to login page
            if not request.user.is_authenticated:
                return redirect(reverse('admin_login'))

            # If not staff, redirect to login page
            if not (request.user.is_staff or request.user.is_superuser):
                return redirect(reverse('admin_login'))

            # If Analyst (staff but not superuser), restrict to the analyst-facing pages
            if request.user.is_staff and not request.user.is_superuser:
                analyst_allowed_prefixes = (
                    '/admin-panel/analyst/',
                    '/admin-panel/report-builder/',
                    '/admin-panel/profile/',
                    '/admin-panel/geojson/',
                )
                if not request.path.startswith(analyst_allowed_prefixes):
                    messages.error(request, "Access denied. You do not have permission to access that page.")
                    return redirect('analyst_dashboard')

        response = self.get_response(request)
        return response
