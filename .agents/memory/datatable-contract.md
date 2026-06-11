---
name: DataTable contract
description: DataRow interface and computed columns for the rich DataTable component.
---

## DataRow interface (frontend/components/DataTable.tsx)
```typescript
interface DataRow {
  name: string
  value: number | null
  type: 'province' | 'district' | 'national'
  sampleSize?: number | null
  province?: string       // parent province name, required for districts
  provinceCode?: number
}
```

## Computed columns (client-side, not in DataRow)
- **rank** — computed from sorted non-national rows by value descending
- **vsNational** — `value - national` (national = first row with type==='national')
- **pctNational** — `(value / national) * 100`
- **quartile** — Q1-Q4 based on rank position within total

## Features
- Sort any column (click header)
- Filter panel: type checkboxes + province dropdown
- Group by Province (collapsible rows, toggled by button)
- Aggregate stats footer: min/max/mean/median of visible non-national rows
- Paginated (15 per page) unless grouped
- CSV export button: includes all columns

**Why:** National row must be included in `rows` array (type='national') for the deviation columns to work; the table extracts national value itself.
