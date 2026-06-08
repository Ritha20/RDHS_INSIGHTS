from django.shortcuts import redirect


def index(request):
    """Redirect the public root to the admin panel."""
    return redirect('admin_dashboard')
