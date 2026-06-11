"""
Background tasks for indicator computation and dataset metadata backfill.

Public entry points
-------------------
trigger_metadata_backfill(ds_pk, file_path)
    Call immediately after saving an uploaded file.  Spawns a daemon thread
    that reads row/variable counts from the DTA header and stores them on the
    DHSUploadedDataset record.  Never blocks the HTTP response.

trigger_indicator_computation(uploaded_by_id, year)
    Call after all files for a survey year are uploaded.  Spawns a daemon
    thread that runs every indicator in dhs_indicator.INDICATORS against the
    available datasets for that year and writes results to the database.
"""

import os
import re
import math
import struct
import logging
import threading

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────
# SHARED HELPER
# ─────────────────────────────────────────────────

def resolve_district_by_name(name):
    """Map a location name to a District DB object, supporting province/national aliases."""
    from .models import District

    if not name:
        return None
    name = name.strip()

    aliases = {
        "Rwanda": "Rwanda",
        "National": "Rwanda",
        "Rwanda (National)": "Rwanda",
        "Kigali City": "Kigali City",
        "South": "Southern Province",
        "West": "Western Province",
        "North": "Northern Province",
        "East": "Eastern Province",
        "East Province": "Eastern Province",
        "Eastern Province": "Eastern Province",
        "Southern Province": "Southern Province",
        "Western Province": "Western Province",
        "Northern Province": "Northern Province",
    }
    mapped = aliases.get(name, name)
    return District.objects.filter(name__iexact=mapped).first()


# ─────────────────────────────────────────────────
# DATASET METADATA  (fast header parse)
# ─────────────────────────────────────────────────

def _parse_dta_header(file_path):
    """
    Read (num_rows, num_vars) from the first 512 bytes of a Stata DTA file.

    Supports:
    - Format 117/118/119  (Stata 13+, XML-based header)
    - Format 113/114      (Stata 12 and earlier, binary header)

    Returns (None, None) if the format is not recognised.
    """
    try:
        with open(file_path, 'rb') as f:
            header = f.read(512)

        # ── XML-based formats 117 / 118 / 119 ─────────────────────────
        # Header starts with b'<stata_dta>' and contains <K>nvar</K> and <N>nobs</N>
        if header[:10] == b'<stata_dta':
            text = header.decode('utf-8', errors='ignore')
            k_match = re.search(r'<K>(\d+)</K>', text)
            n_match = re.search(r'<N>(\d+)</N>', text)
            if k_match and n_match:
                return int(n_match.group(1)), int(k_match.group(1))

        # ── Binary formats 113 / 114 ───────────────────────────────────
        # byte 0 : release number (113 or 114)
        # byte 1 : byte-order   (1 = big-endian, 2 = little-endian)
        # bytes 4-5 : nvar (uint16)
        # bytes 6-9 : nobs (uint32)
        release = header[0]
        if release in (113, 114):
            endian = '<' if header[1] == 2 else '>'
            num_vars = struct.unpack_from(f'{endian}H', header, 4)[0]
            num_rows = struct.unpack_from(f'{endian}I', header, 6)[0]
            return num_rows, num_vars

    except Exception as exc:
        logger.debug("Header parse failed for %s: %s", file_path, exc)

    return None, None


def _fill_metadata(ds_pk, file_path):
    """
    Worker: read row/variable counts and store them on the DHSUploadedDataset.
    Tries the fast binary/XML header parser first; falls back to pyreadstat
    (slower, handles any format) if the header parse does not succeed.
    """
    from django.db import close_old_connections
    from .models import DHSUploadedDataset

    # Each daemon thread must manage its own DB connection.
    close_old_connections()
    try:
        num_rows, num_vars = _parse_dta_header(file_path)

        if num_rows is None or num_vars is None:
            # Fallback: full pyreadstat metadata read (runs in background, never blocks HTTP)
            try:
                import pyreadstat
                _, meta = pyreadstat.read_dta(file_path, metadataonly=True)
                num_rows = meta.number_rows
                num_vars = len(meta.column_names)
            except Exception as exc:
                logger.warning("Could not read metadata for %s: %s", file_path, exc)
                return

        DHSUploadedDataset.objects.filter(pk=ds_pk).update(
            num_rows=num_rows,
            num_vars=num_vars,
        )
        logger.info("Metadata stored — ds_pk=%d  rows=%s  vars=%s", ds_pk, num_rows, num_vars)
    finally:
        close_old_connections()


def trigger_metadata_backfill(ds_pk, file_path):
    """
    Spawn a daemon thread to read and store metadata for one uploaded dataset.
    Called right after the file is written to disk.  Returns immediately.
    """
    t = threading.Thread(
        target=_fill_metadata,
        args=(ds_pk, file_path),
        daemon=True,
        name=f"dhs-meta-{ds_pk}",
    )
    t.start()


# ─────────────────────────────────────────────────
# INDICATOR COMPUTATION
# ─────────────────────────────────────────────────

def _run_computation(uploaded_by_id, year):
    """
    Iterate over every indicator in INDICATORS, load required datasets,
    run the calculation, and persist results.  Called inside a daemon thread.
    """
    from django.db import close_old_connections
    from .dhs_indicator import INDICATORS
    from .dhs_core import load_data
    from .models import (
        DHSUploadedDataset, Category, Indicator,
        IndicatorValue, SystemAuditLog,
    )
    from django.contrib.auth.models import User

    # Each daemon thread must manage its own DB connection.
    close_old_connections()

    user = User.objects.filter(pk=uploaded_by_id).first()
    saved_total = 0
    skipped_total = 0
    error_msgs = []

    # Cache loaded DataFrames — avoids re-reading the same file for every indicator
    loaded_dfs = {}

    def _get_df(recode):
        if recode in loaded_dfs:
            return loaded_dfs[recode]
        ds = (
            DHSUploadedDataset.objects.filter(recode_type=recode, year=year).first()
            or DHSUploadedDataset.objects.filter(recode_type=recode).order_by('-year').first()
        )
        if ds and os.path.exists(ds.file_path):
            df = load_data(ds.file_path)
            if df is not None and not df.empty:
                loaded_dfs[recode] = df
                return df
        return None

    for chapter, indicators in INDICATORS.items():
        category, _ = Category.objects.get_or_create(name=chapter)

        for ind_name, meta in indicators.items():
            datasets = {}
            missing_recodes = []

            for recode in meta['req']:
                df = _get_df(recode)
                if df is not None:
                    datasets[recode] = df
                else:
                    missing_recodes.append(recode)

            if missing_recodes:
                continue  # required dataset not uploaded yet — skip

            try:
                result_df = meta['fn'](datasets)
            except Exception as exc:
                msg = f"{ind_name}: {exc}"
                error_msgs.append(msg)
                logger.warning("Indicator computation error — %s", msg)
                continue

            if result_df is None or result_df.empty:
                continue

            has_category_col = 'Category' in result_df.columns

            indicator_obj, _ = Indicator.objects.get_or_create(
                name=ind_name,
                category=category,
                year=year,
                defaults={'unit': 'Percentage (%)'},
            )

            for _, row in result_df.iterrows():
                loc_name = row.get('Location')
                value = row.get('Value')
                data_label = str(row.get('Category', 'Total')) if has_category_col else 'Total'

                if loc_name is None or value is None:
                    continue
                if isinstance(value, float) and math.isnan(value):
                    continue

                district = resolve_district_by_name(str(loc_name))
                if not district:
                    skipped_total += 1
                    continue

                IndicatorValue.objects.update_or_create(
                    indicator=indicator_obj,
                    district=district,
                    data_label=data_label,
                    year=year,
                    defaults={'value': float(value)},
                )
                saved_total += 1

    success = len(error_msgs) == 0
    details = f"Saved {saved_total} values, skipped {skipped_total} unmatched locations."
    if error_msgs:
        details += f" Errors ({len(error_msgs)}): {'; '.join(error_msgs[:5])}"

    SystemAuditLog.objects.create(
        user=user,
        action='COMPUTE',
        description=f"Background computation completed for year {year}",
        details=details,
        success=success,
    )
    logger.info(
        "Background computation done — year=%s, saved=%d, errors=%d",
        year, saved_total, len(error_msgs),
    )
    close_old_connections()


def trigger_indicator_computation(uploaded_by_id, year):
    """
    Spawn a daemon thread to compute all indicators for *year*.
    Returns immediately so the HTTP response is not blocked.
    """
    t = threading.Thread(
        target=_run_computation,
        args=(uploaded_by_id, year),
        daemon=True,
        name=f"dhs-compute-{year}",
    )
    t.start()
    logger.info("Computation thread started — year=%s", year)
