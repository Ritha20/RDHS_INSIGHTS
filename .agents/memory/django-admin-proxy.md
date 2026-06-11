---
name: Django admin proxy
description: How /admin-panel and /admin are proxied through the Next.js frontend; critical trailing-slash rules.
---

## Rule
Use Next.js catch-all **route handlers** (not `rewrites()`) to proxy `/admin-panel` and `/admin` to the Django backend. Always append a trailing slash to the backend URL in the handler unconditionally.

**Why:** Three compounding problems exist with any simpler approach:
1. Next.js rewrites fight with Django's `APPEND_SLASH` middleware — redirects bounce between the two.
2. `skipTrailingSlashRedirect: true` stops Next.js from stripping slashes, but Replit's own reverse proxy still strips trailing slashes from incoming URLs before they reach Next.js. So the handler can never rely on the incoming path having a slash.
3. Django's auth redirects produce absolute `Location: http://localhost:8000/...` URLs. Route handlers can rewrite that header; rewrites cannot.

## How to apply
- Files: `frontend/app/admin-panel/[[...path]]/route.ts` and `frontend/app/admin/[[...path]]/route.ts`
- Backend URL construction: `${BACKEND}/admin-panel${suffix}/`  — the trailing `/` is hardcoded, not conditional.
- Set `host: localhost:8000` and strip `x-forwarded-*` headers before forwarding.
- Rewrite `Location` header in redirect responses: replace `http://localhost:8000` with `new URL(req.url).origin`.
- Set `redirect: 'manual'` in fetch so Next.js does not auto-follow Django's redirects.
- Django settings needed: `CSRF_TRUSTED_ORIGINS` must include the frontend origin (Replit dev domain + localhost:5000); `SESSION_COOKIE_SECURE = False`; `SESSION_COOKIE_SAMESITE = 'Lax'`.
- Daphne must bind to `0.0.0.0` (not `127.0.0.1`) so the route handler fetch to localhost:8000 can reach it.
