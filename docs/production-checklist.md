# Production checklist

Status on 29 Sep 2026, end of Phase 11. ✅ done and tested · ⏳ needs the product owner · ⚠️ known gap, acceptable for launch.

## Blocks launch

- ⏳ **SMS vendor chosen and integrated.** Phone sign-in needs it; mocks are refused in production. Share the vendor's docs and sandbox keys.
- ⏳ **Accounts:** Vercel, two Supabase projects (staging, production), domain (`docs/deployment.md` steps 0–2).
- ⏳ **Privacy notice and terms** (Act 843), reviewed by a lawyer, linked from sign-in and the footer.

## Ready

- ✅ Tenant isolation: RLS on every table, isolation tested per table (pgTAP 00–20).
- ✅ Double booking impossible: exclusion constraint and concurrency tests.
- ✅ Security review (`docs/security.md`): headers, least-privilege grants, definer functions, rate limits, secret scanning, no known vulnerable dependencies.
- ✅ Accessibility: every main screen (customer, business, admin) passes axe (WCAG 2.2 A/AA) in light and dark, reflows at 200% text, and has no overlap at 360 and 390 px.
- ✅ Performance: public pages ship about 180 KB gzip of JavaScript (framework included) and 5–21 KB of HTML. Every foreign key is indexed. Images are resized before upload.
- ✅ CI: format, lint, types, unit, pgTAP, integration, build, bundle and secrets check, E2E on a phone viewport.
- ✅ Health endpoint (`/api/health`), `robots.txt`, `sitemap.xml`.
- ✅ Admin: overview, businesses, people, suspensions, audit log, verification, review moderation, categories.
- ✅ Payments: customers pay businesses directly; nothing to certify (ADR-0017).
- ✅ Runbook: deploy, release, rollback, monitoring (`docs/deployment.md`).

## Known gaps

- ⚠️ WhatsApp and email vendors not chosen: run with `none` (WhatsApp falls back to SMS; the in-app inbox has everything).
- ⚠️ Admins are added in SQL (no admin-management screen).
- ⚠️ Admin reads aren't audit-logged (changes are).
- ⚠️ CSP allows inline scripts (see `docs/security.md`, "Decisions").
- ⚠️ No native apps; `/api/v1` is ready for them.

## Release checklist (every release)

1. CI green on the PR; preview tried on a phone.
2. New migrations applied to staging, smoke-tested, then applied to production **before** merge.
3. After deploy: `/api/health` ok; sign-in by SMS works; one booking end to end.
4. `pnpm audit --prod` shows no high or critical issues.
