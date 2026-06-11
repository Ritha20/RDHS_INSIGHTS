from fastapi import APIRouter, Query
from typing import Optional
from rdhs_viz.schemas import IndicatorResponse
from rdhs_viz.db_queries import build_indicator_response

router = APIRouter(
    prefix="/chapter4",
    tags=["Chapter 4 - Family Planning"],
    responses={404: {"description": "Indicator not found or not yet computed"}},
)


@router.get("/contraception-use", response_model=IndicatorResponse)
async def get_contraception_use(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Modern Method"),
    method: str = Query("any"),
):
    label_map = {
        "any": "Any Method",
        "modern": "Modern Method",
        "traditional": "Any Method",
    }
    resolved = label_map.get(method, data_label)
    return await build_indicator_response("4.1 Current Contraception", year, region, resolved)


@router.get("/fp-demand", response_model=IndicatorResponse)
async def get_fp_demand(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("4.2 Demand for FP", year, region, data_label)


@router.get("/unmet-need", response_model=IndicatorResponse)
async def get_unmet_need(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("4.2 Demand for FP", year, region, data_label)


@router.get("/demand-satisfied", response_model=IndicatorResponse)
async def get_demand_satisfied(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("4.2 Demand for FP", year, region, data_label)


@router.get("/fp-messages", response_model=IndicatorResponse)
async def get_fp_messages(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Radio"),
    source: str = Query("any"),
):
    label_map = {
        "any": "Radio",
        "radio": "Radio",
        "tv": "TV",
        "health_worker": "Mobile",
    }
    resolved = label_map.get(source, data_label)
    return await build_indicator_response("4.3 Exposure to Messages", year, region, resolved)


@router.get("/fp-exposure", response_model=IndicatorResponse)
async def get_fp_exposure(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Radio"),
    source: str = Query("any"),
):
    label_map = {
        "any": "Radio",
        "radio": "Radio",
        "tv": "TV",
        "health_worker": "Mobile",
    }
    resolved = label_map.get(source, data_label)
    return await build_indicator_response("4.3 Exposure to Messages", year, region, resolved)
