from fastapi import APIRouter, Query
from typing import Optional
from rdhs_viz.schemas import IndicatorResponse
from rdhs_viz.db_queries import build_indicator_response

router = APIRouter(
    prefix="/chapter9",
    tags=["Chapter 9 - HIV Attitude & Knowledge"],
    responses={404: {"description": "Indicator not found or not yet computed"}},
)


@router.get(
    "/hiv-knowledge-prevention",
    response_model=IndicatorResponse,
    summary="9.1 HIV Prevention Knowledge",
)
async def get_hiv_knowledge_prevention(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.1 HIV Knowledge (Prevention)", year, region, data_label)


@router.get("/hiv-testing", response_model=IndicatorResponse, summary="9.1 HIV Testing (alias)")
async def get_hiv_testing(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.1 HIV Knowledge (Prevention)", year, region, data_label)


@router.get(
    "/hiv-knowledge-comprehensive",
    response_model=IndicatorResponse,
    summary="9.2 Comprehensive HIV Knowledge",
)
async def get_hiv_knowledge_comprehensive(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.2 HIV Knowledge (Comprehensive)", year, region, data_label)


@router.get(
    "/multiple-partners",
    response_model=IndicatorResponse,
    summary="9.3 Multiple Sexual Partners (Men)",
)
async def get_multiple_partners(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.3 Multiple Partners (Men)", year, region, data_label)


@router.get(
    "/paid-sex",
    response_model=IndicatorResponse,
    summary="9.4 Paid Sex (Men)",
)
async def get_paid_sex(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.4 Paid Sex (Men)", year, region, data_label)


@router.get("/condom-use-multiple-partners", response_model=IndicatorResponse, summary="9.3 Condom Use Multiple Partners (alias)")
async def get_condom_use_multiple_partners(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.3 Multiple Partners (Men)", year, region, data_label)


@router.get(
    "/sti-prevalence",
    response_model=IndicatorResponse,
    summary="9.5 STI Prevalence / Symptoms (Women)",
)
async def get_sti_prevalence(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.5 STI Prevalence (Women)", year, region, data_label)


@router.get("/sti-symptoms", response_model=IndicatorResponse, summary="9.5 STI Symptoms (alias)")
async def get_sti_symptoms(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.5 STI Prevalence (Women)", year, region, data_label)


@router.get(
    "/circumcision",
    response_model=IndicatorResponse,
    summary="9.6 Male Circumcision",
)
async def get_circumcision(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("9.6 Circumcision (Men)", year, region, data_label)
