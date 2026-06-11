import os
import re

from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Value, CharField
from django.db.models.functions import Concat

from .models import (
    Category, Indicator, IndicatorValue, District, Province,
    DHSUploadedDataset, SystemAuditLog, Invitation,
)


# ─────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────

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
# HELPERS
# ─────────────────────────────────────────────────

def _purge_orphaned_indicators():
    """
    Delete any Indicator / IndicatorValue / Category records that no longer
    have a corresponding uploaded dataset.

    Two cases are handled:
    1. Indicators for a year where NO dataset exists at all.
    2. Indicators for a year where some datasets still exist but the specific
       recode types required by that indicator are all gone.
    """
    from .dhs_indicator import INDICATORS as _IND_REGISTRY

    uploaded_years = set(
        DHSUploadedDataset.objects.values_list('year', flat=True).distinct()
    )

    # Case 1: years with no datasets at all → nuke everything for those years
    Indicator.objects.exclude(year__in=uploaded_years).delete()

    # Case 2: years that still have SOME datasets → check per-indicator requirements
    for year in uploaded_years:
        remaining_recodes = set(
            DHSUploadedDataset.objects.filter(year=year)
            .values_list('recode_type', flat=True)
        )
        orphaned_names = [
            name
            for chapter_inds in _IND_REGISTRY.values()
            for name, meta in chapter_inds.items()
            if not set(meta['req']).issubset(remaining_recodes)
        ]
        if orphaned_names:
            IndicatorValue.objects.filter(
                indicator__name__in=orphaned_names, year=year
            ).delete()
            Indicator.objects.filter(
                name__in=orphaned_names, year=year
            ).delete()

    # Remove categories that now have no indicators left
    Category.objects.filter(indicators__isnull=True).delete()


# ─────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────

def admin_dashboard_view(request):
    import os as _os
    recent_logs = SystemAuditLog.objects.select_related('user').all()[:5]
    uploaded_datasets = DHSUploadedDataset.objects.all().order_by('recode_type')

    # Storage: sum of DTA file sizes
    dhs_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'DHS', 'data'))
    storage_mb = 0
    if _os.path.exists(dhs_data_dir):
        for fname in _os.listdir(dhs_data_dir):
            fp = _os.path.join(dhs_data_dir, fname)
            if _os.path.isfile(fp):
                storage_mb += _os.path.getsize(fp)
    storage_mb = round(storage_mb / (1024 * 1024), 1)

    # Survey rounds — only years that actually have uploaded datasets
    survey_years = list(
        DHSUploadedDataset.objects.values_list('year', flat=True).distinct().order_by('year')
    )

    # All stats scoped to years that have uploaded datasets so orphaned rows
    # left over from datasets deleted outside the normal flow never inflate counts.
    if survey_years:
        total_values     = IndicatorValue.objects.filter(year__in=survey_years).count()
        total_indicators = Indicator.objects.filter(year__in=survey_years).count()
        total_categories = Category.objects.filter(
            indicators__year__in=survey_years
        ).distinct().count()
        total_districts  = District.objects.filter(
            indicator_values__year__in=survey_years,
            province__name__in=[
                'Kigali City', 'Southern Province', 'Western Province',
                'Northern Province', 'Eastern Province',
            ]
        ).exclude(
            name__in=[
                'Kigali City', 'Southern Province', 'Western Province',
                'Northern Province', 'Eastern Province',
            ]
        ).distinct().count()
    else:
        total_values = total_indicators = total_categories = total_districts = 0

    context = {
        'total_categories': total_categories,
        'total_indicators': total_indicators,
        'total_values':     total_values,
        'total_districts':  total_districts,
        'total_users':      User.objects.count(),
        'uploaded_datasets': uploaded_datasets,
        'recent_logs':      recent_logs,
        'storage_mb':       storage_mb,
        'survey_rounds':    len(survey_years),
        'year_min':         survey_years[0]  if survey_years else None,
        'year_max':         survey_years[-1] if survey_years else None,
        'engine_ok':        total_values > 0,
    }
    return render(request, 'admin/dashboard.html', context)


# ─────────────────────────────────────────────────
# DATASET UPLOAD  (triggers background computation)
# ─────────────────────────────────────────────────

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


def dataset_delete_view(request, pk):
    ds = get_object_or_404(DHSUploadedDataset, pk=pk)
    if request.method == 'POST':
        recode = ds.recode_type
        year = ds.year

        try:
            if os.path.exists(ds.file_path):
                os.remove(ds.file_path)
        except OSError:
            pass

        desc = str(ds)

        # Snapshot counts BEFORE purge for the audit message
        ind_before = Indicator.objects.count()
        val_before = IndicatorValue.objects.count()

        ds.delete()  # remove dataset record (and physical file above)

        # Purge any indicators / values whose required datasets are now missing
        _purge_orphaned_indicators()

        deleted_inds = ind_before - Indicator.objects.count()
        deleted_vals = val_before - IndicatorValue.objects.count()

        audit(
            request, 'DATA_DELETE',
            f"Deleted dataset: {desc}",
            details=(
                f"Removed {deleted_inds} indicator(s) and {deleted_vals} value(s) "
                f"linked to {recode} recode for year {year}. "
                "Re-uploading this dataset will recompute them automatically."
            ),
        )
        messages.success(
            request,
            f"Deleted '{desc}' and removed {deleted_inds} related indicator(s). "
            "Re-upload the file to recompute.",
        )
    return redirect('admin_dataset_upload')


# ─────────────────────────────────────────────────
# USER MANAGEMENT
# ─────────────────────────────────────────────────

def user_list_view(request):
    users = User.objects.all().order_by('-date_joined')
    q = request.GET.get('q', '').strip()
    if q:
        users = _user_search_qs(q)
    paginator = Paginator(users, 20)
    page_obj = paginator.get_page(request.GET.get('page'))
    return render(request, 'admin/users/list.html', {'page_obj': page_obj, 'q': q})


def _user_search_qs(raw_q):
    """Return a User queryset matching raw_q across multiple fields."""
    q = re.sub(r'\s+', ' ', raw_q.strip())[:200]  # normalise + cap length
    qs = User.objects.annotate(
        full_name=Concat('first_name', Value(' '), 'last_name', output_field=CharField())
    ).filter(
        Q(username__icontains=q) |
        Q(email__icontains=q) |
        Q(first_name__icontains=q) |
        Q(last_name__icontains=q) |
        Q(full_name__icontains=q)
    ).distinct().order_by('-date_joined')
    return qs


def user_search_api(request):
    """JSON endpoint for live user search."""
    raw_q = request.GET.get('q', '').strip()
    q = re.sub(r'\s+', ' ', raw_q)[:200]

    users = _user_search_qs(q) if q else User.objects.all().order_by('-date_joined')

    results = []
    for u in users[:100]:
        results.append({
            'id': u.id,
            'username': u.username,
            'full_name': u.get_full_name() or u.username,
            'email': u.email or '',
            'is_superuser': u.is_superuser,
            'is_staff': u.is_staff,
            'is_active': u.is_active,
            'last_login': u.last_login.strftime('%Y-%m-%d %H:%M') if u.last_login else None,
        })

    return JsonResponse({'users': results, 'count': len(results)})


def _generate_temp_password(length=12):
    import secrets, string
    alphabet = string.ascii_letters + string.digits + '!@#$%&'
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        # Ensure at least one of each: upper, lower, digit, special
        if (any(c.isupper() for c in pwd) and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd) and any(c in '!@#$%&' for c in pwd)):
            return pwd


def _send_credentials_email(user, temp_password):
    from django.conf import settings as conf
    site_url = getattr(conf, 'SITE_URL', 'http://127.0.0.1:8000')
    login_url = f"{site_url}/admin-panel/"
    role_label = 'Admin' if user.is_staff else 'Analyst'
    full_name  = user.get_full_name() or user.username

    html = f"""
<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:32px 16px;">
  <div style="background:#1e3a8a;border-radius:14px 14px 0 0;padding:26px 32px;display:flex;align-items:center;gap:14px;">
    <div>
      <div style="color:#fff;font-size:1.15rem;font-weight:700;margin:0;">RDHS Insights</div>
      <div style="color:rgba(255,255,255,0.5);font-size:0.78rem;margin-top:2px;">National Institute of Statistics of Rwanda</div>
    </div>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:30px 32px;">
    <p style="color:#1e293b;font-size:1rem;font-weight:600;margin:0 0 6px;">Hello, {full_name}</p>
    <p style="color:#475569;font-size:0.88rem;margin:0 0 22px;line-height:1.6;">
      Your <strong>RDHS Insights</strong> account has been created. You can now access the platform using the credentials below.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 22px;margin-bottom:22px;">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <tr>
          <td style="color:#64748b;padding:5px 0;width:120px;">Role</td>
          <td style="color:#1e293b;font-weight:600;">{role_label}</td>
        </tr>
        <tr>
          <td style="color:#64748b;padding:5px 0;">Email</td>
          <td style="color:#1e293b;font-weight:600;">{user.email}</td>
        </tr>
        <tr>
          <td style="color:#64748b;padding:5px 0;">Temp Password</td>
          <td style="color:#1e293b;font-family:monospace;font-size:1rem;font-weight:700;letter-spacing:0.05em;">{temp_password}</td>
        </tr>
      </table>
    </div>

    <a href="{login_url}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:9px;text-decoration:none;font-weight:600;font-size:0.9rem;margin-bottom:22px;">
      Go to RDHS Insights &#8594;
    </a>

    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:9px;padding:14px 16px;">
      <p style="color:#92400e;font-size:0.8rem;margin:0;line-height:1.6;">
        <strong>&#x26A0; Security notice:</strong> This is a temporary password generated by the system.
        Please change it after your first login for security purposes.
      </p>
    </div>
  </div>
  <p style="color:#94a3b8;font-size:0.7rem;text-align:center;margin-top:16px;">
    This email was sent by RDHS Insights. If you did not expect this, contact your administrator.
  </p>
</div>"""

    plain = (
        f"Hello {full_name},\n\n"
        f"Your RDHS Insights account has been created.\n\n"
        f"Role:           {role_label}\n"
        f"Email:          {user.email}\n"
        f"Temp Password:  {temp_password}\n\n"
        f"Login at: {login_url}\n\n"
        f"Please change your password after your first login.\n\n"
        f"— RDHS Admin Team"
    )

    api_key = getattr(conf, 'RESEND_API_KEY', '')
    if api_key:
        try:
            import resend as _resend
            _resend.api_key = api_key
            _resend.Emails.send({
                'from': getattr(conf, 'DEFAULT_FROM_EMAIL', 'RDHS Insights <noreply@rdhs.gov.rw>'),
                'to':   [user.email],
                'subject': 'Your RDHS Insights Account',
                'html': html,
                'text': plain,
            })
            return True
        except Exception:
            return False
    else:
        from django.core.mail import send_mail
        try:
            send_mail(
                'Your RDHS Insights Account', plain,
                getattr(conf, 'DEFAULT_FROM_EMAIL', 'noreply@rdhs.gov.rw'),
                [user.email], html_message=html, fail_silently=False,
            )
            return True
        except Exception:
            return False


def user_create_view(request):
    if request.method == 'POST':
        username   = request.POST.get('username', '').strip()
        email      = request.POST.get('email', '').strip()
        password   = request.POST.get('password', '')
        first_name = request.POST.get('first_name', '').strip()
        last_name  = request.POST.get('last_name', '').strip()
        is_staff   = 'is_staff' in request.POST
        is_active  = 'is_active' in request.POST

        if not all([username, email, first_name, last_name, password]):
            messages.error(request, "All fields are required.")
            return render(request, 'admin/users/form.html', {'title': 'Create User'})

        if User.objects.filter(username=username).exists():
            messages.error(request, f"Username '{username}' already exists.")
            return render(request, 'admin/users/form.html', {'title': 'Create User'})

        User.objects.create_user(
            username=username, email=email, password=password,
            first_name=first_name, last_name=last_name,
            is_staff=is_staff, is_superuser=is_staff,
            is_active=is_active,
        )
        audit(request, 'USER_CREATE', f"Created user: {username}")
        messages.success(request, f"User '{username}' created successfully.")
        return redirect('admin_user_list')

    return render(request, 'admin/users/form.html', {'title': 'Create User'})


def user_edit_view(request, pk):
    u = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        u.email      = request.POST.get('email', '').strip()
        u.first_name = request.POST.get('first_name', '').strip()
        u.last_name  = request.POST.get('last_name', '').strip()
        u.is_staff   = 'is_staff' in request.POST
        u.is_superuser = u.is_staff
        u.is_active  = 'is_active' in request.POST
        password = request.POST.get('password', '').strip()
        if password:
            u.set_password(password)
        u.save()

        audit(request, 'USER_UPDATE', f"Updated user: {u.username}")
        messages.success(request, f"User '{u.username}' updated.")
        return redirect('admin_user_list')

    return render(request, 'admin/users/form.html', {
        'title': f"Edit User — {u.username}",
        'u': u,
    })


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

def _audit_action_codes_for(q):
    """Return action codes whose display label contains q (case-insensitive)."""
    q_lower = q.lower()
    return [
        code for code, label in SystemAuditLog.ACTION_CHOICES
        if q_lower in label.lower()
    ]


def _audit_filter_qs(logs, q, scope):
    """
    Filter by scope (pre-filter, applied even with no query) then narrow
    by text query within the scoped set.

    Scopes:
      all       – every log; text searches all fields
      user      – USER_CREATE / UPDATE / DELETE events; text searches username
      session   – LOGIN / LOGOUT events; text searches username
      indicator – COMPUTE events; text searches description + details
      dataset   – UPLOAD / DATA_DELETE events; text searches description + details
      ip        – logs that have an IP address; text searches IP field
      action    – no pre-filter; text searches action code + display label
    """
    # ── Step 1: scope pre-filter ───────────────────────────────────────────
    if scope == 'user':
        logs = logs.filter(action__in=['USER_CREATE', 'USER_UPDATE', 'USER_DELETE'])
    elif scope == 'session':
        logs = logs.filter(action__in=['LOGIN', 'LOGOUT'])
    elif scope == 'indicator':
        logs = logs.filter(action='COMPUTE')
    elif scope == 'dataset':
        logs = logs.filter(action__in=['UPLOAD', 'DATA_DELETE'])
    elif scope == 'ip':
        logs = logs.filter(ip_address__isnull=False)
    # 'all' and 'action' → no pre-filter

    # ── Step 2: text search within the scoped set ─────────────────────────
    if not q:
        return logs

    matching_codes = _audit_action_codes_for(q)

    if scope in ('user', 'session'):
        return logs.filter(user__username__icontains=q)

    if scope in ('indicator', 'dataset'):
        return logs.filter(
            Q(description__icontains=q) | Q(details__icontains=q)
        ).distinct()

    if scope == 'ip':
        return logs.filter(ip_address__icontains=q)

    if scope == 'action':
        qs = Q(action__icontains=q)
        if matching_codes:
            qs |= Q(action__in=matching_codes)
        return logs.filter(qs)

    # scope == 'all' — search every field
    qs = (
        Q(user__username__icontains=q) |
        Q(description__icontains=q)    |
        Q(details__icontains=q)        |
        Q(ip_address__icontains=q)     |
        Q(action__icontains=q)
    )
    if matching_codes:
        qs |= Q(action__in=matching_codes)
    return logs.filter(qs).distinct()


def audit_log_view(request):
    from datetime import datetime

    logs = SystemAuditLog.objects.select_related('user').all()

    q              = re.sub(r'\s+', ' ', request.GET.get('q', '').strip())[:200]
    scope          = request.GET.get('scope', 'all')
    success_filter = request.GET.get('success', '')
    date_from      = request.GET.get('date_from', '').strip()

    logs = _audit_filter_qs(logs, q, scope)

    if success_filter == '1':
        logs = logs.filter(success=True)
    elif success_filter == '0':
        logs = logs.filter(success=False)
    if date_from:
        try:
            logs = logs.filter(
                timestamp__date__gte=datetime.strptime(date_from, '%Y-%m-%d').date()
            )
        except ValueError:
            date_from = ''

    paginator = Paginator(logs, 30)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'admin/audit/list.html', {
        'page_obj':       page_obj,
        'q':              q,
        'scope':          scope,
        'success_filter': success_filter,
        'date_from':      date_from,
    })


def audit_search_api(request):
    """JSON endpoint for live audit log search (all fields + scope)."""
    from datetime import datetime as _dt

    q              = re.sub(r'\s+', ' ', request.GET.get('q', '').strip())[:200]
    scope          = request.GET.get('scope', 'all')
    success_filter = request.GET.get('success', '')
    date_from_str  = request.GET.get('date_from', '').strip()

    logs = SystemAuditLog.objects.select_related('user').all().order_by('-timestamp')

    logs = _audit_filter_qs(logs, q, scope)

    if success_filter == '1':
        logs = logs.filter(success=True)
    elif success_filter == '0':
        logs = logs.filter(success=False)

    if date_from_str:
        try:
            logs = logs.filter(
                timestamp__date__gte=_dt.strptime(date_from_str, '%Y-%m-%d').date()
            )
        except ValueError:
            pass

    results = []
    for log in logs[:200]:
        results.append({
            'ts_date':        log.timestamp.strftime('%Y-%m-%d'),
            'ts_time':        log.timestamp.strftime('%H:%M:%S'),
            'username':       log.user.username if log.user else None,
            'ip':             log.ip_address or '',
            'action_display': log.get_action_display(),
            'description':    log.description or '',
            'details':        log.details or '',
            'success':        log.success,
        })

    return JsonResponse({'logs': results, 'count': len(results)})
