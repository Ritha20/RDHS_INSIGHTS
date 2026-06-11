from fastapi import APIRouter, Query
from typing import Optional
from rdhs_viz.schemas import IndicatorResponse
from rdhs_viz.db_queries import build_indicator_response

router = APIRouter(
    prefix="/chapter6",
    tags=["Chapter 6 - Child Health"],
    responses={404: {"description": "Indicator not found or not yet computed"}},
)


@router.get(
    "/illness-prevalence",
    response_model=IndicatorResponse,
    summary="6.1–6.3 Child Illness Prevalence (ARI / Fever / Diarrhea)",
)
async def get_illness_prevalence(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Fever"),
):
    return await build_indicator_response("6.1-6.3 Illness Prevalence (ARI/Fever/Diarrhea)", year, region, data_label)


@router.get("/diarrhea", response_model=IndicatorResponse, summary="6.1 Diarrhea Prevalence")
async def get_diarrhea(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Diarrhea"),
):
    return await build_indicator_response("6.1-6.3 Illness Prevalence (ARI/Fever/Diarrhea)", year, region, data_label)


@router.get("/fever", response_model=IndicatorResponse, summary="6.2 Fever Prevalence")
async def get_fever(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Fever"),
):
    return await build_indicator_response("6.1-6.3 Illness Prevalence (ARI/Fever/Diarrhea)", year, region, data_label)


@router.get("/ari", response_model=IndicatorResponse, summary="6.3 ARI Symptoms")
async def get_ari(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("ARI"),
):
    return await build_indicator_response("6.1-6.3 Illness Prevalence (ARI/Fever/Diarrhea)", year, region, data_label)


@router.get("/diarrhea-treatment", response_model=IndicatorResponse, summary="6.1 Diarrhea Treatment")
async def get_diarrhea_treatment(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Diarrhea"),
):
    return await build_indicator_response("6.1-6.3 Illness Prevalence (ARI/Fever/Diarrhea)", year, region, data_label)


@router.get(
    "/child-anemia",
    response_model=IndicatorResponse,
    summary="6.4 Anemia in Children",
)
async def get_child_anemia(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("6.4 Anemia (Children)", year, region, data_label)


@router.get("/anemia-children", response_model=IndicatorResponse, summary="6.4 Anemia Children (alias)")
async def get_anemia_children(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("6.4 Anemia (Children)", year, region, data_label)
