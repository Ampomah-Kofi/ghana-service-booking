# Environment Variables

Validated at startup: server values in [`src/server/env.ts`](../src/server/env.ts), browser values in [`src/lib/public-env.ts`](../src/lib/public-env.ts).
Rule: **`NEXT_PUBLIC_*` is shipped to every browser. Never put a secret there.** CI (`pnpm check:secrets`) fails if a secret appears in the client bundle.

## App (`.env.local` locally; Vercel project settings per environment)

| Name                                   | Scope      | Required            | Purpose                                                                                                                                        | Local value                                  |
| -------------------------------------- | ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `APP_ENV`                              | server     | yes                 | `local` \| `test` \| `staging` \| `production`. Gates mocks and dev-only routes                                                                | `local`                                      |
| `NEXT_PUBLIC_SITE_URL`                 | public     | yes                 | Absolute URLs (email links, share links, QR codes)                                                                                             | `http://localhost:3000`                      |
| `NEXT_PUBLIC_SUPABASE_URL`             | public     | yes                 | Supabase API URL                                                                                                                               | `http://127.0.0.1:54321`                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public     | yes                 | Publishable ("anon") key. Safe in browsers because RLS applies                                                                                 | from `pnpm exec supabase status`             |
| `SUPABASE_SECRET_KEY`                  | **server** | yes                 | Secret ("service_role") key. **Bypasses RLS.** Only `src/server/privileged/*` may read it (lint-enforced)                                      | from `pnpm exec supabase status`             |
| `SEND_SMS_HOOK_SECRET`                 | **server** | yes                 | Verifies Supabase Auth → `/api/internal/auth/send-sms` calls (Standard Webhooks, `v1,whsec_<base64>`). Must equal the value in `supabase/.env` | `echo "v1,whsec_$(openssl rand -base64 32)"` |
| `SMS_PROVIDER`                         | server     | yes                 | SMS channel provider. Only `mock` exists until Phase 8. **`mock` is refused when `APP_ENV=production`**                                        | `mock`                                       |
| `WHATSAPP_PROVIDER`                    | server     | no (default `mock`) | WhatsApp channel provider (Phase 8). **`mock` refused in production**                                                                          | `mock`                                       |
| `EMAIL_PROVIDER`                       | server     | no (default `mock`) | Email channel provider (Phase 8). **`mock` refused in production**                                                                             | `mock`                                       |
| `CRON_SECRET`                          | **server** | for sending         | Bearer secret for `/api/internal/jobs/dispatch` (≥ 32 chars). Unset = the dispatcher answers 503                                               | `openssl rand -hex 32`                       |
| `PAYMENTS_PROVIDER`                    | server     | no (default `mock`) | `mock` \| `none` (Phase 9). `none` = online payment off, customers just book. **`mock` refused when `APP_ENV=production`**                     | `mock`                                       |
| `PAYMENTS_WEBHOOK_SECRET`              | **server** | with `mock`         | Signs mock webhooks (≥ 32 chars). A real provider's secret gets its own variable                                                               | `openssl rand -hex 32`                       |
| `DEFAULT_COUNTRY_CODE`                 | server     | yes                 | Default region for parsing phones typed without `+`. Country data itself lives in the DB                                                       | `GH`                                         |

## Supabase CLI (`supabase/.env`, local only)

| Name                               | Purpose                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `SEND_SMS_HOOK_SECRET`             | Substituted into `supabase/config.toml` `[auth.hook.send_sms].secrets`                                          |
| `SUPABASE_INTERNAL_IMAGE_REGISTRY` | _(shell env, optional)_ Set to `docker.io` if your network blocks `public.ecr.aws` (the default image registry) |

## Hosted Supabase (dashboard settings, not env vars)

Configured per project (staging, production) in the Supabase dashboard. Record changes in the release notes:

- **Auth → Hooks → Send SMS:** HTTPS hook to `https://<site>/api/internal/auth/send-sms`, with a secret that matches `SEND_SMS_HOOK_SECRET` in Vercel.
- **Auth → Providers → Phone:** enabled. **No test OTPs on hosted projects.**
- **Auth → SMS OTP expiry:** 300 seconds, OTP length 6.
- **Auth → Rate limits:** SMS sent per hour, reviewed against SMS spend.
- **Auth → URL configuration:** Site URL = `NEXT_PUBLIC_SITE_URL`, redirect allow-list includes `<site>/auth/callback`.

## Sending notifications (Phase 8)

- **Local:** `node scripts/dev/dispatch-loop.mjs` (sends due messages every 30 s through the mock providers; they print to the app log).
- **Hosted Supabase**, once per environment (SQL editor), with the site URL and the same `CRON_SECRET` as Vercel:
  ```sql
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  select vault.create_secret('<CRON_SECRET>', 'cron_secret');
  select cron.schedule('dispatch-notifications', '* * * * *', $$
    select net.http_post(
      url := 'https://<site>/api/internal/jobs/dispatch',
      headers := jsonb_build_object('Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')))
  $$);
  ```
  Rotating: update the Vault secret and the Vercel variable together (the route compares in constant time).

## Payments job (Phase 9)

- **Local:** `node scripts/dev/dispatch-loop.mjs` also calls `/api/internal/jobs/payments` (expire holds, reconcile, refunds).
- **Hosted:** schedule it like the dispatcher, every minute:
  ```sql
  select cron.schedule('payments-job', '* * * * *', $$
    select net.http_post(
      url := 'https://<site>/api/internal/jobs/payments',
      headers := jsonb_build_object('Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')))
  $$);
  ```
- The provider's webhook URL is `https://<site>/api/internal/webhooks/payments/<provider>`.

## Rotation

1. `SEND_SMS_HOOK_SECRET`: Supabase hooks accept several space-separated secrets. Add the new one in Supabase and deploy the app with the new value, then remove the old one.
2. `SUPABASE_SECRET_KEY`: create a new secret key in the Supabase dashboard, update Vercel, redeploy, then revoke the old key.
