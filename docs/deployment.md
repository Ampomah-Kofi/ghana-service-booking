# Deployment runbook

How to run Booker GH for real: **Vercel** (the Next.js app) and **hosted Supabase** (Postgres, Auth, Storage), with one **staging** and one **production** environment. Each step names who does it. Steps marked **(you)** need the product owner's accounts, payment details or secrets; I never handle those.

Nothing here adds infrastructure beyond what the app already uses (CLAUDE.md: MVP for one developer).

## 0. Before the first deploy (you)

1. **SMS vendor for phone sign-in.** Choose one (e.g. Hubtel, Arkesel, mNotify) and share its API docs and sandbox keys. I then write its `SmsProvider` from the official docs (never guessed) and add it to `SMS_PROVIDER`. **Production cannot start without this**: mocks are refused when `APP_ENV=production`.
2. WhatsApp and email are optional at launch: set `WHATSAPP_PROVIDER=none` and `EMAIL_PROVIDER=none` (WhatsApp messages then go by SMS; the in-app inbox always has everything).
3. A domain (e.g. `bookergh.com`) you can edit DNS for.
4. Privacy notice and terms (Act 843), reviewed by a lawyer.

## 1. Supabase projects (you, about 15 minutes each)

Create two projects in the Supabase dashboard: `booker-staging` and `booker-production`. For Ghana, pick the region closest to your users (e.g. `eu-west` / London). Then, per project:

1. **Link and push the schema** (on your machine, from the repo):
   ```bash
   pnpm exec supabase login                      # opens the browser
   pnpm exec supabase link --project-ref <ref>   # ref from Project Settings → General
   pnpm exec supabase db push                    # applies supabase/migrations in order
   ```
   Success: `db push` lists every migration as applied, and **Table Editor** shows `businesses`, `appointments` and the others with RLS "enabled".
   Do **not** run `supabase/seed.sql` or `supabase/demo/*` on production (they contain test users and a fixed OTP).
2. **Reference data** (currencies, countries, regions, cities, areas, categories) comes from migration `20261011090100_reference_data.sql`. Check with `select count(*) from public.categories;` (expect 33).
3. **Storage:** create buckets `public-media` (public) and `private-uploads` (private), with the same limits as `supabase/config.toml` (`[storage.buckets.*]`). The storage policies come from the migrations.
4. **Auth → Providers → Phone:** enabled; confirmations off. **No test OTPs.**
5. **Auth → Hooks → Send SMS:** HTTPS hook to `https://<domain>/api/internal/auth/send-sms`. Generate its secret in the dashboard and copy it into Vercel as `SEND_SMS_HOOK_SECRET`.
6. **Auth → Rate limits:** SMS sent per hour sized to your SMS budget; keep token verifications at about 30 per 5 minutes. **Auth → Phone:** OTP expiry 300 s, resend interval 60 s.
7. **Auth → URL configuration:** Site URL `https://<domain>`; redirect allow-list `https://<domain>/auth/callback` (staging: its Vercel URL).
8. **Auth → Password security:** turn on leaked-password protection (email/password sign-in).
9. **Database → Extensions:** `pg_cron` and `pg_net` on. Then schedule the notification dispatcher (SQL in `docs/env.md` → "Sending notifications").
10. **Backups:** production on a plan with daily backups; enable Point-in-Time Recovery when the business can afford it.

## 2. Vercel project (you, about 10 minutes)

1. Import the GitHub repo. Framework: Next.js; install `pnpm install --frozen-lockfile`; build `pnpm build`.
2. **Environment variables**: see `docs/env.md` for meanings. Production values:

   | Name                                                               | Production                                                                       |
   | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
   | `APP_ENV`                                                          | `production` (staging: `staging`)                                                |
   | `NEXT_PUBLIC_SITE_URL`                                             | `https://<domain>`                                                               |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from Supabase → Project Settings → API                                           |
   | `SUPABASE_SECRET_KEY`                                              | secret key from the same page (**server only; never a `NEXT_PUBLIC_` variable**) |
   | `SEND_SMS_HOOK_SECRET`                                             | the Send SMS hook secret (step 1.5)                                              |
   | `SMS_PROVIDER`                                                     | the real vendor's id once integrated                                             |
   | `WHATSAPP_PROVIDER`, `EMAIL_PROVIDER`                              | `none` until vendors are chosen                                                  |
   | `CRON_SECRET`                                                      | `openssl rand -hex 32`, the same value as the Vault secret used by pg_cron       |
   | `DEFAULT_COUNTRY_CODE`                                             | `GH`                                                                             |
   | vendor keys                                                        | e.g. `SMS_<VENDOR>_API_KEY`, added with the vendor adapter                       |

3. **Domains:** add `<domain>` and `www.<domain>`, and point DNS as Vercel shows. HTTPS is automatic.
4. Deploy. Every pull request gets a preview deployment. Point previews at **staging** Supabase, never production.

## 3. First production deploy (about 20 minutes)

1. `supabase db push` to **production** (step 1.1).
2. Merge to `main`: CI runs formatting, lint, types, unit, pgTAP, integration, build, secrets/bundle check and E2E. Vercel deploys only after it.
3. **Smoke test** (on a phone):
   - `https://<domain>/api/health` returns `{"status":"ok","database":"ok"}`;
   - the home page loads, and search "barber" answers (empty until businesses join);
   - sign in with a real phone number: the SMS arrives within a minute, and the code signs you in;
   - create a test business, publish it, and book it from a second phone. Both phones get "You're booked" / "New booking";
   - `curl -sI https://<domain>/ | grep -i strict-transport` shows HSTS;
   - `https://<domain>/sitemap.xml` lists the business; `robots.txt` names the sitemap.
4. **First admin:** after you sign up with your own phone, in the Supabase SQL editor:
   `insert into public.platform_admins (user_id, role) select id, 'super_admin' from public.profiles where phone_e164 = '+233…';`
   Then open `https://<domain>/admin`.
5. Delete the test business from **/admin** (suspend), or remove it in SQL, before announcing.

## 4. Releasing changes

1. Branch `phase-N-…` or `fix-…`, then a PR. CI must be green. Try the preview.
2. Migrations are forward-only. Apply them to **staging** first (`supabase link` to staging, then `db push`), smoke-test staging, then production **before** merging code that needs them.
3. Merge. Vercel deploys. Re-run the smoke test's first two checks.

## 5. Rollback

- **App:** Vercel → Deployments → the previous one → "Promote to Production" (instant).
- **Database:** migrations aren't reversed automatically. Write a new forward migration that undoes the change, and test it on staging. For data loss, restore from a Supabase backup or PITR (Database → Backups) into a new project, then copy back what's needed.

## 6. Monitoring

- **Uptime:** point a free monitor (e.g. UptimeRobot or Better Stack) at `https://<domain>/api/health` every minute and alert by SMS/email.
- **Errors:** Vercel → Logs (functions). Server code logs `[db]`, `[action]`, `[api/v1]`, `[dispatch]` prefixes.
- **Database:** Supabase → Reports (CPU, connections, slow queries) and **Advisors** (security and performance lints). Check weekly.
- **Messages:** failed notifications appear in `public.notifications` with `status = 'failed'` and `last_error`.

## 7. Secrets rotation

See `docs/env.md` → Rotation. Rotate `SUPABASE_SECRET_KEY` and `CRON_SECRET` if anyone who had them leaves.
