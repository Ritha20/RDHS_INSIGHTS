from django import forms


class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput(attrs={'class': 'form-control'}))
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        single_file_clean = super().clean
        if isinstance(data, (list, tuple)):
            return [single_file_clean(d, initial) for d in data]
        return single_file_clean(data, initial)


class DHSUploadForm(forms.Form):
    """Form used on the dataset upload page."""
    year = forms.IntegerField(
        initial=2022,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'min': 2000,
            'max': 2100,
            'placeholder': 'e.g. 2022',
        }),
        help_text="The survey year these datasets belong to (e.g. 2022 or 2025).",
    )
    dta_files = MultipleFileField(
        help_text="Upload one or more raw Stata (.DTA) files, e.g. RWPR81FL.DTA, RWIR81FL.DTA.",
    )
