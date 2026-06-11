from fastapi import APIRouter, Query
from typing import Optional
from rdhs_viz.schemas import IndicatorResponse
from rdhs_viz.db_queries import build_indicator_response

router = APIRouter(
    prefix="/chapter8",
    tags=["Chapter 8 - Malaria"],
    responses={404: {"description": "Indicator not found or not yet computed"}},
)


@router.get("/itn-use-total", response_model=IndicatorResponse)
async def get_itn_use_total(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("8.1 ITN Use (Total HH Pop)", year, region, data_label)


@router.get("/itn-ownership", response_model=IndicatorResponse)
async def get_itn_ownership(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("8.1 ITN Use (Total HH Pop)", year, region, data_label)


@router.get("/itn-usage-population", response_model=IndicatorResponse)
async def get_itn_usage_population(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("8.1 ITN Use (Total HH Pop)", year, region, data_label)


@router.get("/itn-usage-pregnant", response_model=IndicatorResponse)
async def get_itn_usage_pregnant(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("8.1 ITN Use (Total HH Pop)", year, region, data_label)


@router.get("/itn-use-children", response_model=IndicatorResponse)
async def get_itn_use_children(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("8.2 ITN Use (Children)", year, region, data_label)


@router.get("/itn-usage-children", response_model=IndicatorResponse)
async def get_itn_usage_children(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("8.2 ITN Use (Children)", year, region, data_label)


@router.get("/malaria-prevalence", response_model=IndicatorResponse)
async def get_malaria_prevalence(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Children 6-59m"),
):
    return await build_indicator_response("8.3/8.4 Malaria Prevalence", year, region, data_label)


@router.get("/malaria-prevalence-children", response_model=IndicatorResponse)
async def get_malaria_prevalence_children(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Children 6-59m"),
    test_type: str = Query("rdt"),
):
    return await build_indicator_response("8.3/8.4 Malaria Prevalence", year, region, "Children 6-59m")


@router.get("/fever-treatment", response_model=IndicatorResponse)
async def get_fever_treatment(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Children 6-59m"),
):
    return await build_indicator_response("8.3/8.4 Malaria Prevalence", year, region, data_label)
