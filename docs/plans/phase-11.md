# Phase 11 plan: security, performance, accessibility, testing, deployment, production readiness

Started 28 Sep ("approved"; the product owner asked not to wait for plan approval).

**Goal:** the app is safe, fast and accessible enough to put in front of real people in Ghana. Anything it needs for deployment is written down step by step, and whatever still blocks launch is named plainly.

## Scope

1. **Security review** (SPEC §21), written up in `docs/security.md`.
   - **HTTP headers** on every response:
     - Content-Security-Policy;
     - HSTS in production;
     - `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`;
     - no framing.
   - **Database guarantees, tested with pgTAP** (`20_security`):
     - every SECURITY DEFINER function pins `search_path`;
     - the functions anonymous visitors can call match an allowlist;
     - anonymous visitors have no write grants on any table;
     - every public table has RLS (already tested in `00_rls_coverage`).
   - **Rate limits:**
     - check the OTP and SMS limits in `supabase/config.toml`;
     - bookings are already capped at 10 per person per hour in the database;
     - add a database-side cap on review reports and new businesses per person.
   - **Dependencies:** `pnpm audit`, and fix anything high or critical.
2. **Performance:**
   - index every foreign key (a pgTAP check lists unindexed ones, and a migration adds them);
   - check first-load JavaScript per route from the build and keep public pages lean;
   - add cache headers for static public API responses (they already exist; verify).
3. **Accessibility:** a full sweep of every main screen (customer, business and admin) with axe (light and dark), 200% text, and overlap at 360 and 390 px. Fix the findings.
4. **Testing:** the full suite, with the new DB tests in CI, plus a documented release checklist.
5. **Production readiness:**
   - `GET /api/health` for uptime monitoring (app plus database);
   - `robots.txt` and `sitemap.xml` covering published businesses and categories, so people can find businesses from Google;
   - `docs/deployment.md`: Vercel plus hosted Supabase, env vars per environment, migrations, auth and hook settings, pg_cron, domains, smoke test, rollback, backups, monitoring;
   - `docs/production-checklist.md`: what's ready, and what blocks launch.

## Key decisions

- **CSP without nonces.** A nonce-based policy would force every page to render dynamically. The app never injects HTML (React escapes everything; there is no `dangerouslySetInnerHTML`), so `script-src 'self' 'unsafe-inline'` is acceptable. Every other directive is locked down: `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and images, API calls and uploads allowed only from the app and Supabase. This can be revisited with SRI hashes later (Next's experimental option).
- **No new infrastructure.** Rate limits live in the database, the same way the booking guard does. Monitoring uses the health endpoint and Vercel/Supabase dashboards.
- **Real vendors stay out.** The known launch blocker is SMS: phone sign-in needs a real SMS provider, and mocks are refused in production. That provider is chosen by the product owner and integrated from its official docs (CLAUDE.md).
