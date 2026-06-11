from django.db import models
from django.contrib.auth.models import User


class Category(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        # Remove "Chapter X:" prefix if present, return only the descriptive name
        if ':' in self.name:
            return self.name.split(':', 1)[1].strip()
        return self.name

    class Meta:
        verbose_name_plural = "Categories"


class Province(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class District(models.Model):
    name = models.CharField(max_length=100)
    province = models.ForeignKey(Province, on_delete=models.CASCADE, related_name='districts')

    def __str__(self):
        return f"{self.name} ({self.province.name})"


class Indicator(models.Model):
    name = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='indicators')
    unit = models.CharField(max_length=50)
    year = models.IntegerField(default=2022)

    def __str__(self):
        return f"{self.name} ({self.year})"


class IndicatorValue(models.Model):
    indicator = models.ForeignKey(Indicator, on_delete=models.CASCADE, related_name='values')
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name='indicator_values')
    data_label = models.CharField(max_length=100, default='Total')
    year = models.IntegerField(default=2022)
    value = models.FloatField()

    def __str__(self):
        return f"{self.indicator.name} - {self.district.name} ({self.data_label}) - {self.year}"


class DHSUploadedDataset(models.Model):
    """Tracks DHS dataset files that have been uploaded by the admin."""
    RECODE_CHOICES = [
        ('HR', 'Household Recode (HR)'),
        ('PR', 'Household Members Recode (PR)'),
        ('IR', 'Individual (Women) Recode (IR)'),
        ('MR', 'Men Recode (MR)'),
        ('KR', 'Children Recode (KR)'),
        ('BR', 'Births Recode (BR)'),
        ('CR', 'Couples Recode (CR)'),
    ]
    recode_type = models.CharField(max_length=10, choices=RECODE_CHOICES)
    original_filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    year = models.IntegerField()
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    num_rows = models.IntegerField(null=True, blank=True)
    num_vars = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.recode_type} - {self.original_filename} ({self.year})"

    class Meta:
        unique_together = ('recode_type', 'year')
        ordering = ['-uploaded_at']


class Invitation(models.Model):
    ROLE_CHOICES = [
        ('analyst', 'Analyst'),
        ('admin', 'Admin'),
    ]
    email       = models.EmailField()
    token       = models.CharField(max_length=64, unique=True)
    role        = models.CharField(max_length=20, choices=ROLE_CHOICES, default='analyst')
    invited_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_invitations')
    created_at  = models.DateTimeField(auto_now_add=True)
    expires_at  = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    is_used      = models.BooleanField(default=False)
    is_cancelled = models.BooleanField(default=False)

    @property
    def is_expired(self):
        from django.utils import timezone
        return not self.is_used and not self.is_cancelled and timezone.now() > self.expires_at

    @property
    def status(self):
        if self.is_used:      return 'accepted'
        if self.is_cancelled: return 'cancelled'
        if self.is_expired:   return 'expired'
        return 'pending'

    def __str__(self):
        return f"Invitation<{self.email} {self.status}>"

    class Meta:
        ordering = ['-created_at']


class SystemAuditLog(models.Model):
    """Tracks all significant actions performed by admin users."""
    ACTION_CHOICES = [
        ('UPLOAD', 'Dataset Upload'),
        ('COMPUTE', 'Indicator Computation'),
        ('USER_CREATE', 'User Created'),
        ('USER_UPDATE', 'User Updated'),
        ('USER_DELETE', 'User Deleted'),
        ('LOGIN', 'Admin Login'),
        ('LOGOUT', 'Admin Logout'),
        ('DATA_DELETE', 'Data Deleted'),
        ('INVITE_SENT', 'Invitation Sent'),
        ('INVITE_ACCEPT', 'Invitation Accepted'),
        ('OTHER', 'Other'),
    ]
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES, default='OTHER')
    description = models.CharField(max_length=500)
    details = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    success = models.BooleanField(default=True)

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.user} — {self.get_action_display()}"

    class Meta:
        ordering = ['-timestamp']
