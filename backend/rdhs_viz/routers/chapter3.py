from fastapi import APIRouter, Query
from typing import Optional
from rdhs_viz.schemas import IndicatorResponse
from rdhs_viz.db_queries import build_indicator_response

router = APIRouter(
    prefix="/chapter3",
    tags=["Chapter 3 - Fertility Determinants & Rates"],
    responses={404: {"description": "Indicator not found or not yet computed"}},
)


@router.get("/median-age-first-marriage", response_model=IndicatorResponse)
async def get_median_age_marriage(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("3.1 Median Age at First Marriage", year, region, data_label)


@router.get("/birth-intervals", response_model=IndicatorResponse)
async def get_birth_intervals(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("3.2 Birth Interval", year, region, data_label)


@router.get("/median-age-first-birth", response_model=IndicatorResponse)
async def get_median_age_birth(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("3.3 Median Age at First Birth", year, region, data_label)


@router.get("/teenage-pregnancy", response_model=IndicatorResponse)
async def get_teenage_pregnancy(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("3.4 Teenage Pregnancy", year, region, data_label)


@router.get("/mean-children-ever-born", response_model=IndicatorResponse)
async def get_mean_children_ever_born(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Observed TFR (15-49)"),
):
    return await build_indicator_response("3.5 Fertility (Mean Children Ever Born)", year, region, data_label)


@router.get("/fertility-rate", response_model=IndicatorResponse, summary="3.5 Total Fertility Rate (alias)")
async def get_fertility_rate(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Observed TFR (15-49)"),
    rate_type: str = Query("observed"),
):
    label_map = {
        "observed": "Observed TFR (15-49)",
        "wanted": "Wanted TFR (15-49)",
        "mean": "Mean Children Ever Born (40-49)",
    }
    resolved = label_map.get(rate_type, data_label)
    return await build_indicator_response("3.5 Fertility (Mean Children Ever Born)", year, region, resolved)
