from fastapi import APIRouter, Query
from typing import Optional
from rdhs_viz.schemas import IndicatorResponse
from rdhs_viz.db_queries import build_indicator_response

router = APIRouter(
    prefix="/chapter1",
    tags=["Chapter 1 - Household Characteristics"],
    responses={404: {"description": "Indicator not found or not yet computed"}},
)

ASSET_MAP = {
    "electricity": ("1.1 Electricity coverage", "Total"),
    "mobile": ("1.2 Household durable goods", "Mobile Phone"),
    "radio": ("1.2 Household durable goods", "Radio"),
    "tv": ("1.2 Household durable goods", "Television"),
    "computer": ("1.2 Household durable goods", "Computer"),
    "refrigerator": ("1.2 Household durable goods", "Refrigerator"),
    "bicycle": ("1.2 Household durable goods", "Bicycle"),
    "motorcycle": ("1.2 Household durable goods", "Motorcycle"),
}


@router.get("/electricity", response_model=IndicatorResponse, summary="1.1 Electricity Coverage")
async def get_electricity(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("1.1 Electricity coverage", year, region, data_label)


@router.get("/household-assets", response_model=IndicatorResponse, summary="1.2 Household Durable Goods")
async def get_household_assets(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    asset: str = Query("radio", description="Asset key: electricity, mobile, radio, tv, computer, refrigerator, bicycle, motorcycle"),
    data_label: Optional[str] = Query(None, description="Override data_label (auto-resolved from asset if omitted)"),
):
    indicator_name, default_label = ASSET_MAP.get(asset.lower(), ("1.2 Household durable goods", "Radio"))
    resolved_label = data_label if data_label else default_label
    return await build_indicator_response(indicator_name, year, region, resolved_label)


@router.get("/handwashing", response_model=IndicatorResponse, summary="1.3 Hand Washing Place")
async def get_handwashing(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Fixed place"),
):
    return await build_indicator_response("1.3 Hand washing place", year, region, data_label)
