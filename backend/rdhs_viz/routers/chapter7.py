from fastapi import APIRouter, Query
from typing import Optional
from rdhs_viz.schemas import IndicatorResponse
from rdhs_viz.db_queries import build_indicator_response

router = APIRouter(
    prefix="/chapter7",
    tags=["Chapter 7 - Nutrition (Children & Women)"],
    responses={404: {"description": "Indicator not found or not yet computed"}},
)


@router.get("/child-nutrition", response_model=IndicatorResponse)
async def get_child_nutrition(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Stunting (Height-for-Age)"),
):
    return await build_indicator_response("7.1 Child Nutrition Status", year, region, data_label)


@router.get("/stunting", response_model=IndicatorResponse)
async def get_stunting(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Stunting (Height-for-Age)"),
    severity: str = Query("any"),
):
    return await build_indicator_response("7.1 Child Nutrition Status", year, region, "Stunting (Height-for-Age)")


@router.get("/wasting", response_model=IndicatorResponse)
async def get_wasting(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Wasting (Weight-for-Height)"),
    severity: str = Query("any"),
):
    return await build_indicator_response("7.1 Child Nutrition Status", year, region, "Wasting (Weight-for-Height)")


@router.get("/underweight", response_model=IndicatorResponse)
async def get_underweight(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Underweight (Weight-for-Age)"),
    severity: str = Query("any"),
):
    return await build_indicator_response("7.1 Child Nutrition Status", year, region, "Underweight (Weight-for-Age)")


@router.get("/overweight-children", response_model=IndicatorResponse)
async def get_overweight_children(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Stunting (Height-for-Age)"),
):
    return await build_indicator_response("7.1 Child Nutrition Status", year, region, "Stunting (Height-for-Age)")


@router.get("/women-bmi", response_model=IndicatorResponse)
async def get_women_bmi(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Overweight"),
    category: str = Query("underweight"),
):
    label_map = {
        "underweight": "Thin",
        "normal": "Normal",
        "overweight": "Overweight",
        "obese": "Overweight",
    }
    resolved = label_map.get(category, data_label)
    return await build_indicator_response("7.2 Women's BMI", year, region, resolved)


@router.get("/women-anemia", response_model=IndicatorResponse)
async def get_women_anemia(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
):
    return await build_indicator_response("7.3 Women's Anemia", year, region, data_label)


@router.get("/anemia-women", response_model=IndicatorResponse)
async def get_anemia_women(
    year: Optional[int] = Query(None),
    region: Optional[int] = Query(None, ge=1, le=5),
    data_label: str = Query("Total"),
    severity: str = Query("any"),
):
    return await build_indicator_response("7.3 Women's Anemia", year, region, data_label)
