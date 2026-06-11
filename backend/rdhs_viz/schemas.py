from pydantic import BaseModel, model_validator
from typing import Optional


class DistrictResult(BaseModel):
    district_id: int
    district_code: int = 0
    district_name: str
    value: Optional[float]
    sample_size: Optional[int] = None
    data_label: str

    @model_validator(mode='after')
    def fill_district_code(self):
        if not self.district_code:
            self.district_code = self.district_id
        return self


class ProvinceResult(BaseModel):
    province_id: int
    province_code: int = 0
    province_name: str
    value: Optional[float]
    sample_size: Optional[int] = None

    @model_validator(mode='after')
    def fill_province_code(self):
        if not self.province_code:
            self.province_code = self.province_id
        return self


class NationalResult(BaseModel):
    value: Optional[float]
    sample_size: Optional[int] = None


class IndicatorResponse(BaseModel):
    indicator: str
    unit: str
    category: str
    population_type: str = ""
    year: int
    data_source: str = "DHS Rwanda 2019-20"
    calculation_method: Optional[str] = None
    districts: list[DistrictResult]
    provinces: list[ProvinceResult]
    national: NationalResult

    @model_validator(mode='after')
    def fill_population_type(self):
        if not self.population_type:
            self.population_type = self.category
        return self


class IndicatorSummary(BaseModel):
    name: str
    unit: str
    years_available: list[int]


class ChapterSummary(BaseModel):
    chapter: str
    indicators: list[IndicatorSummary]


class ProvinceInfo(BaseModel):
    dhs_code: int
    name: str
    district_count: int
    districts: list[str]


class DatasetInfo(BaseModel):
    id: int
    recode_type: str
    year: int
    original_filename: str
    uploaded_at: str
    num_rows: Optional[int]
    num_vars: Optional[int]
