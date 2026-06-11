export interface DistrictData {
  district_code: number
  district_name: string
  value: number | null
  sample_size: number | null
}

export interface ProvinceData {
  province_code: number
  province_name: string
  value: number | null
  sample_size: number | null
}

export interface NationalData {
  value: number | null
  sample_size: number | null
}

export interface IndicatorResponse {
  indicator: string
  unit: string
  population_type: string
  year: string | null
  districts: DistrictData[]
  provinces: ProvinceData[]
  national: NationalData
  data_source: string
  calculation_method: string | null
}

export interface ProvinceChartEntry {
  name: string
  code: number
  value: number | null
  districts: DistrictData[]
}

export interface IndicatorParam {
  key: string
  label: string
  options: { value: string; label: string }[]
  default: string
}

export interface IndicatorConfig {
  id: string
  name: string
  path: string
  fixedParams: Record<string, string>
  dynamicParams?: IndicatorParam[]
  description: string
}

export interface ChapterConfig {
  slug: string
  title: string
  icon: string
  indicators: IndicatorConfig[]
}

export const PROVINCES = [
  { code: 1, name: 'Kigali City' },
  { code: 2, name: 'Southern Province' },
  { code: 3, name: 'Western Province' },
  { code: 4, name: 'Northern Province' },
  { code: 5, name: 'Eastern Province' },
]
