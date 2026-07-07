from asgiref.sync import sync_to_async
from fastapi import HTTPException
from indicators.models import Indicator, IndicatorValue, Province
from rdhs_viz.schemas import IndicatorResponse, DistrictResult, ProvinceResult, NationalResult

# DHS survey province codes (v024 / hv024) → province name stored in DB
DHS_PROVINCE_NAMES = {
    1: "Kigali City",
    2: "Southern Province",
    3: "Western Province",
    4: "Northern Province",
    5: "Eastern Province",
}


def _province_name(dhs_code: int) -> str | None:
    return DHS_PROVINCE_NAMES.get(dhs_code)


@sync_to_async
def _fetch_indicator(indicator_name: str):
    qs = Indicator.objects.select_related('category').filter(name=indicator_name).order_by('-year')
    return qs.first()


@sync_to_async
def _latest_year_for(indicator_id: int, data_label: str, province_name: str | None = None):
    qs = IndicatorValue.objects.filter(indicator_id=indicator_id, data_label=data_label)
    if province_name is not None:
        qs = qs.filter(district__province__name=province_name)
    return qs.values_list('year', flat=True).order_by('-year').first()


@sync_to_async
def _fetch_values(indicator_id: int, year: int, data_label: str, province_name: str | None = None):
    qs = IndicatorValue.objects.filter(
        indicator_id=indicator_id,
        year=year,
        data_label=data_label,
        district__level='district',          # exclude province-level and national-level rows
    ).select_related('district', 'district__province')
    if province_name is not None:
        qs = qs.filter(district__province__name=province_name)
    return list(qs)


@sync_to_async
def _fetch_national_value(indicator_id: int, year: int, data_label: str) -> float | None:
    """Fetch the stored national-level value from DB (district__level='national')."""
    val = IndicatorValue.objects.filter(
        indicator_id=indicator_id,
        year=year,
        data_label=data_label,
        district__level='national',
    ).first()
    return val.value if val else None


@sync_to_async
def _fetch_province_rows(indicator_id: int, year: int, data_label: str):
    """Fetch all stored province-level rows from DB (district__level='province')."""
    return list(
        IndicatorValue.objects.filter(
            indicator_id=indicator_id,
            year=year,
            data_label=data_label,
            district__level='province',
        ).select_related('district')
    )


async def build_indicator_response(
    indicator_name: str,
    year: int | None = None,
    region: int | None = None,
    data_label: str = "Total",
) -> IndicatorResponse:
    # Translate DHS province code (1–5) to province name for DB lookup
    province_name = _province_name(region) if region is not None else None
    if region is not None and province_name is None:
        raise HTTPException(status_code=422, detail=f"Invalid region {region}. Use 1=Kigali, 2=Southern, 3=Western, 4=Northern, 5=Eastern.")

    indicator = await _fetch_indicator(indicator_name)
    if indicator is None:
        raise HTTPException(status_code=404, detail=f"Indicator '{indicator_name}' not found or not yet computed.")

    resolved_year = year
    if resolved_year is None:
        resolved_year = await _latest_year_for(indicator.id, data_label, province_name)
    if resolved_year is None:
        resolved_year = indicator.year

    # Fetch district-level rows (filtered by province when region is specified)
    values = await _fetch_values(indicator.id, resolved_year, data_label, province_name)

    # Fetch stored national and province values from DB
    stored_national = await _fetch_national_value(indicator.id, resolved_year, data_label)
    stored_province_rows = await _fetch_province_rows(indicator.id, resolved_year, data_label)

    # reverse map: province name → DHS code
    name_to_dhs = {v: k for k, v in DHS_PROVINCE_NAMES.items()}

    districts: list[DistrictResult] = []
    # key: province name → {dhs_code, vals} — used as fallback if no stored province rows
    prov_groups: dict[str, dict] = {}

    for v in values:
        if not v.district:
            continue
        districts.append(DistrictResult(
            district_id=v.district_id,
            district_name=v.district.name,
            value=v.value,
            data_label=v.data_label,
        ))
        p = v.district.province
        if p and p.name in name_to_dhs:
            pname = p.name
            if pname not in prov_groups:
                prov_groups[pname] = {"dhs_code": name_to_dhs[pname], "vals": []}
            if v.value is not None:
                prov_groups[pname]["vals"].append(v.value)

    # Build province results — prefer stored province-level rows from DB
    if stored_province_rows:
        # Filter to the requested province when region is specified
        prov_rows_to_use = stored_province_rows
        if province_name is not None:
            prov_rows_to_use = [r for r in stored_province_rows if r.district.name == province_name]

        provinces: list[ProvinceResult] = [
            ProvinceResult(
                province_id=name_to_dhs.get(r.district.name, 0),
                province_name=r.district.name,
                value=r.value,
            )
            for r in prov_rows_to_use
            if r.district.name in name_to_dhs
        ]
    else:
        # Fallback: compute province averages from district values
        provinces = [
            ProvinceResult(
                province_id=info["dhs_code"],
                province_name=pname,
                value=round(sum(info["vals"]) / len(info["vals"]), 1) if info["vals"] else None,
            )
            for pname, info in prov_groups.items()
        ]

    # National value — prefer stored national row, fallback to district average
    if stored_national is not None:
        national_val = stored_national
    else:
        all_vals = [d.value for d in districts if d.value is not None]
        national_val = round(sum(all_vals) / len(all_vals), 1) if all_vals else None

    return IndicatorResponse(
        indicator=indicator.name,
        unit=indicator.unit,
        category=indicator.category.name if indicator.category else "",
        year=resolved_year,
        districts=districts,
        provinces=provinces,
        national=NationalResult(value=national_val),
    )
