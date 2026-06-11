import os
import json
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import user_passes_test
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q

from .models import (
    Category, Indicator, IndicatorValue, District, Province,
    DHSUploadedDataset, SystemAuditLog,
)


# ─────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────

def admin_required(user):
    return user.is_authenticated and user.is_superuser


def analyst_required(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')


def audit(request, action, description, details=None, success=True):
    SystemAuditLog.objects.create(
        user=request.user if request.user.is_authenticated else None,
        action=action,
        description=description,
        details=details,
        ip_address=get_client_ip(request),
        success=success,
    )


DHS_DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'DHS', 'data'))

RECODE_MAP = {
    'hr': 'HR', 'pr': 'PR', 'ir': 'IR',
    'mr': 'MR', 'kr': 'KR', 'br': 'BR', 'cr': 'CR',
}


def identify_recode(filename):
    """Return the recode key (HR/PR/IR…) from a DHS filename."""
    name = filename.lower()
    for code in RECODE_MAP:
        if code in name:
            return RECODE_MAP[code]
    return None


# ─────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────

def admin_login_view(request):
    if request.user.is_authenticated:
        if request.user.is_superuser:
            return redirect('admin_dashboard')
        elif request.user.is_staff:
            return redirect('analyst_dashboard')

    context = {}
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            if user.is_active and user.is_staff:
                login(request, user)
                audit(request, 'LOGIN', f'User login: {username}')
                if user.is_superuser:
                    return redirect(request.GET.get('next', 'admin_dashboard'))
                else:
                    return redirect(request.GET.get('next', 'analyst_dashboard'))
            else:
                context['error_message'] = "Access denied. Active staff/admin privileges required."
        else:
            context['error_message'] = "Invalid username or password."

    return render(request, 'admin/admin_login.html', context)


def admin_logout_view(request):
    if request.user.is_authenticated:
        audit(request, 'LOGOUT', f'User logout: {request.user.username}')
    logout(request)
    return redirect('admin_login')


# ─────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────

@user_passes_test(admin_required, login_url='admin_login')
def admin_dashboard_view(request):
    recent_logs = SystemAuditLog.objects.select_related('user').all()[:10]
    uploaded_datasets = DHSUploadedDataset.objects.all().order_by('recode_type')

    context = {
        'total_categories': Category.objects.count(),
        'total_indicators': Indicator.objects.count(),
        'total_values': IndicatorValue.objects.count(),
        'total_districts': District.objects.filter(
            level=District.DISTRICT,
            indicator_values__isnull=False,
        ).distinct().count(),
        'total_users': User.objects.count(),
        'uploaded_datasets': uploaded_datasets,
        'recent_logs': recent_logs,
    }
    return render(request, 'admin/dashboard.html', context)


@user_passes_test(analyst_required, login_url='admin_login')
def analyst_dashboard_view(request):
    context = {
        'total_categories': Category.objects.count(),
        'total_indicators': Indicator.objects.count(),
        'total_values': IndicatorValue.objects.count(),
        'total_districts': District.objects.filter(
            level=District.DISTRICT,
            indicator_values__isnull=False,
        ).distinct().count(),
    }
    return render(request, 'admin/analyst_dashboard.html', context)


@user_passes_test(analyst_required, login_url='admin_login')
def report_builder_view(request):
    """
    Dedicated report design workspace (Google Docs-style canvas with a live
    indicator library on the left and a properties panel on the right).
    """
    audit(request, 'OTHER', 'Opened Report Builder workspace')
    return render(request, 'admin/report_builder.html', {})


@user_passes_test(analyst_required, login_url='admin_login')
def user_profile_view(request):
    u = request.user
    if request.method == 'POST':
        u.email = request.POST.get('email', '').strip()
        u.first_name = request.POST.get('first_name', '').strip()
        u.last_name = request.POST.get('last_name', '').strip()
        password = request.POST.get('password', '').strip()
        if password:
            u.set_password(password)
        u.save()

        if password:
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, u)

        audit(request, 'USER_UPDATE', f"Updated own profile: {u.username}")
        messages.success(request, "Your profile has been updated successfully.")
        return redirect('user_profile')

    return render(request, 'admin/users/profile.html', {
        'title': 'My Profile',
        'u': u,
    })


@user_passes_test(analyst_required, login_url='admin_login')
def geojson_view(request):
    path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'rwanda-districts.geojson'))
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return JsonResponse(data)


# ─────────────────────────────────────────────────
# DATASET UPLOAD  (triggers background computation)
# ─────────────────────────────────────────────────

@user_passes_test(admin_required, login_url='admin_login')
def dataset_upload_view(request):
    """
    Upload one or more .dta files.  After saving them to DHS/data/, a
    background thread automatically computes all indicators for the year.
    """
    if not os.path.exists(DHS_DATA_DIR):
        os.makedirs(DHS_DATA_DIR)

    if request.method == 'POST':
        year = request.POST.get('year', '').strip()
        if not year.isdigit():
            messages.error(request, "Please provide a valid survey year.")
            return redirect('admin_dataset_upload')

        year = int(year)
        files = request.FILES.getlist('dta_files')
        if not files:
            messages.error(request, "No files selected.")
            return redirect('admin_dataset_upload')

        saved = 0
        for f in files:
            recode = identify_recode(f.name)
            if not recode:
                messages.warning(request, f"Skipped '{f.name}': cannot identify recode type.")
                continue

            target_path = os.path.join(DHS_DATA_DIR, f"{recode}_{year}.DTA")
            with open(target_path, 'wb+') as dest:
                for chunk in f.chunks():
                    dest.write(chunk)

            ds, _ = DHSUploadedDataset.objects.update_or_create(
                recode_type=recode,
                year=year,
                defaults={
                    'original_filename': f.name,
                    'file_path': target_path,
                    'uploaded_by': request.user,
                    'num_rows': None,
                    'num_vars': None,
                },
            )
            audit(
                request, 'UPLOAD',
                f"Uploaded {recode} dataset ({year})",
                details=f"File: {f.name}",
            )
            # Read row/var counts in the background — does not block this request
            from .tasks import trigger_metadata_backfill
            trigger_metadata_backfill(ds.pk, target_path)
            saved += 1

        if saved:
            messages.success(
                request,
                f"Uploaded {saved} dataset(s) for year {year}. "
                "Indicator computation is running in the background — "
                "results will appear in the dashboard shortly.",
            )
            from .tasks import trigger_indicator_computation
            trigger_indicator_computation(request.user.pk, year)

        return redirect('admin_dataset_upload')

    uploaded = DHSUploadedDataset.objects.all().order_by('year', 'recode_type')
    return render(request, 'admin/data/upload.html', {'uploaded': uploaded})


@user_passes_test(admin_required, login_url='admin_login')
def dataset_delete_view(request, pk):
    ds = get_object_or_404(DHSUploadedDataset, pk=pk)
    if request.method == 'POST':
        year        = ds.year
        recode_type = ds.recode_type

        # Remove the physical file
        try:
            if os.path.exists(ds.file_path):
                os.remove(ds.file_path)
        except OSError:
            pass

        desc = str(ds)
        ds.delete()

        # Find only the indicator names that required this recode type.
        # Indicators that use other recodes are unaffected.
        from .dhs_indicator import INDICATORS
        affected_names = [
            ind_name
            for chapter_inds in INDICATORS.values()
            for ind_name, meta in chapter_inds.items()
            if recode_type in meta['req']
        ]

        # Delete only the affected indicators (cascades to IndicatorValue).
        deleted_values = IndicatorValue.objects.filter(
            indicator__name__in=affected_names, year=year
        ).count()
        Indicator.objects.filter(name__in=affected_names, year=year).delete()

        # Clean up chapters that now have no remaining indicators.
        Category.objects.filter(indicators__isnull=True).delete()

        audit(
            request, 'DATA_DELETE',
            f"Deleted dataset: {desc} — removed {len(affected_names)} indicator(s) "
            f"({deleted_values} values) requiring {recode_type}",
        )
        messages.success(
            request,
            f"Dataset '{desc}' deleted. "
            f"{len(affected_names)} indicator(s) and {deleted_values:,} value(s) that required "
            f"{recode_type} data have been removed. "
            "Other indicators are unaffected.",
        )
        return redirect('admin_dashboard')
    return redirect('admin_dataset_upload')


# ─────────────────────────────────────────────────
# USER MANAGEMENT
# ─────────────────────────────────────────────────

@user_passes_test(admin_required, login_url='admin_login')
def user_list_view(request):
    users = User.objects.all().order_by('-date_joined')
    q = request.GET.get('q', '')
    if q:
        users = users.filter(Q(username__icontains=q) | Q(email__icontains=q))
    paginator = Paginator(users, 20)
    page_obj = paginator.get_page(request.GET.get('page'))
    return render(request, 'admin/users/list.html', {'page_obj': page_obj, 'q': q})


@user_passes_test(admin_required, login_url='admin_login')
def user_create_view(request):
    if request.method == 'POST':
        username   = request.POST.get('username', '').strip()
        email      = request.POST.get('email', '').strip()
        password   = request.POST.get('password', '')
        first_name = request.POST.get('first_name', '').strip()
        last_name  = request.POST.get('last_name', '').strip()
        role       = request.POST.get('role', 'analyst')
        is_active  = 'is_active' in request.POST

        if not all([username, email, first_name, last_name, password]):
            messages.error(request, "All fields are required.")
            return render(request, 'admin/users/form.html', {'title': 'Create User'})

        if User.objects.filter(username=username).exists():
            messages.error(request, f"Username '{username}' already exists.")
            return render(request, 'admin/users/form.html', {'title': 'Create User'})

        is_staff = True
        is_superuser = (role == 'admin')

        user = User.objects.create_user(
            username=username, email=email, password=password,
            first_name=first_name, last_name=last_name,
            is_staff=is_staff, is_superuser=is_superuser,
            is_active=is_active,
        )

        audit(request, 'USER_CREATE', f"Created user: {username} (Role: {role})")
        messages.success(request, f"User '{username}' created successfully.")
        return redirect('admin_user_list')

    return render(request, 'admin/users/form.html', {'title': 'Create User'})


@user_passes_test(admin_required, login_url='admin_login')
def user_edit_view(request, pk):
    u = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        u.email      = request.POST.get('email', '').strip()
        u.first_name = request.POST.get('first_name', '').strip()
        u.last_name  = request.POST.get('last_name', '').strip()
        role         = request.POST.get('role', 'analyst')
        u.is_staff   = True
        u.is_superuser = (role == 'admin')
        u.is_active  = 'is_active' in request.POST
        password = request.POST.get('password', '').strip()
        if password:
            u.set_password(password)
        u.save()

        audit(request, 'USER_UPDATE', f"Updated user: {u.username} (Role: {role})")
        messages.success(request, f"User '{u.username}' updated.")
        return redirect('admin_user_list')

    return render(request, 'admin/users/form.html', {
        'title': f"Edit User — {u.username}",
        'u': u,
    })


@user_passes_test(admin_required, login_url='admin_login')
def user_delete_view(request, pk):
    target_user = get_object_or_404(User, pk=pk)
    if target_user == request.user:
        messages.error(request, "You cannot delete your own account.")
        return redirect('admin_user_list')
    if request.method == 'POST':
        name = target_user.username
        target_user.delete()
        audit(request, 'USER_DELETE', f"Deleted user: {name}")
        messages.success(request, f"User '{name}' deleted.")
    return redirect('admin_user_list')


@user_passes_test(admin_required, login_url='admin_login')
def user_toggle_active_view(request, pk):
    target_user = get_object_or_404(User, pk=pk)
    if target_user == request.user:
        messages.error(request, "You cannot deactivate your own account.")
    else:
        target_user.is_active = not target_user.is_active
        target_user.save()
        status = "activated" if target_user.is_active else "deactivated"
        audit(request, 'USER_UPDATE', f"User {status}: {target_user.username}")
        messages.success(request, f"User '{target_user.username}' {status}.")
    return redirect('admin_user_list')


# ─────────────────────────────────────────────────
# AUDIT LOGS
# ─────────────────────────────────────────────────

@user_passes_test(admin_required, login_url='admin_login')
def audit_log_view(request):
    from datetime import datetime

    all_logs = SystemAuditLog.objects.select_related('user').all()
    total_count = all_logs.count()
    success_count = all_logs.filter(success=True).count()
    failed_count = all_logs.filter(success=False).count()

    logs = all_logs
    action_filter = request.GET.get('action', '')
    user_filter = request.GET.get('user', '').strip()
    success_filter = request.GET.get('success', '')
    date_from = request.GET.get('date_from', '').strip()
    date_to = request.GET.get('date_to', '').strip()

    if action_filter:
        logs = logs.filter(action=action_filter)
    if user_filter:
        logs = logs.filter(user__username__icontains=user_filter)
    if success_filter == '1':
        logs = logs.filter(success=True)
    elif success_filter == '0':
        logs = logs.filter(success=False)
    if date_from:
        try:
            logs = logs.filter(timestamp__date__gte=datetime.strptime(date_from, '%Y-%m-%d').date())
        except ValueError:
            date_from = ''
    if date_to:
        try:
            logs = logs.filter(timestamp__date__lte=datetime.strptime(date_to, '%Y-%m-%d').date())
        except ValueError:
            date_to = ''

    paginator = Paginator(logs, 30)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'admin/audit/list.html', {
        'page_obj': page_obj,
        'action_choices': SystemAuditLog.ACTION_CHOICES,
        'action_filter': action_filter,
        'user_filter': user_filter,
        'success_filter': success_filter,
        'date_from': date_from,
        'date_to': date_to,
        'total_count': total_count,
        'success_count': success_count,
        'failed_count': failed_count,
    })
