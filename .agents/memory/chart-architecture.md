---
name: Chart architecture
description: ChartContainer.tsx is the unified chart component; types, exports, and color constants.
---

## Rule
All charts use `ChartContainer` from `frontend/components/charts/ChartContainer.tsx`. Never use `ProvinceBarChart` or other one-off chart components for new work.

## Exports from ChartContainer.tsx
- `default ChartContainer` — renders chart based on `chartType` prop
- `ChartTypeSelector` — toggle button row for switching chart types
- `CHART_COLORS` — 10-color palette array
- `type ChartType` = `'bar-h' | 'bar-v' | 'line' | 'pie' | 'radar'`
- `interface ChartEntry` = `{ name: string; value: number | null; code: number }`

## Key props
- `data: ChartEntry[]` — province or district entries
- `national?: number | null` — draws reference line (bar/line charts)
- `unit: string` — 'Percentage' triggers % formatting
- `chartType: ChartType` — controlled externally
- `onSelect?: (code, name) => void` — click handler for province/district selection
- `selected?: number | null` — highlights selected bar
- `height?: number` — override default height (auto-calculated from data.length for bar-h)
- `colors?: string[]` — override CHART_COLORS per-entry palette

**Why:** Having one chart component means chart type switching, color themes, null handling, and tooltip formatting are maintained in one place.
