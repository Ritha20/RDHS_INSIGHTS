---
name: NISR color theme
description: The official NISR branding colors used throughout the dashboard
---

The dashboard uses NISR (National Institute of Statistics of Rwanda) branding:

- Primary navy: `#1B3C74` — sidebar background, primary actions, loading dots
- Navy dark: `#0D2550` — hover states, selected province on map
- Navy light: `#2A509A` — lighter variants
- Cyan: `#0099D4` — accent color, active nav indicator, highlights
- Cyan light: `#4AB8E0` — secondary text on dark backgrounds

**Tailwind config:** Both `nisr.*` and `rwanda.*` keys exist. `rwanda-green` maps to `#1B3C74` (navy) for backward compatibility with existing components that use `bg-rwanda-green`, `text-rwanda-green`, etc.

**Logo:** NISR logo stored at `frontend/public/nisr-logo.png`. Use `<img>` tag (not `next/image`) to avoid dimension warnings. Ensure file permissions are 644.

**How to apply:** Use `bg-nisr-navy` for primary backgrounds, `text-nisr-cyan` for accent text, `border-nisr-cyan/30` for subtle borders on dark backgrounds.
