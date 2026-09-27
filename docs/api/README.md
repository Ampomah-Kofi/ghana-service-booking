# API

## Public / mobile API: `/api/v1`
No endpoints yet. The first ones (catalogue and search reads) arrive in Phase 4. Shape, auth and versioning rules are in [`../architecture.md` §12](../architecture.md).

## Internal endpoints (not for clients)
| Method & path | Caller | Auth | Purpose |
|---|---|---|---|
| `POST /api/internal/auth/send-sms` | Supabase Auth (Send SMS Hook) | Standard Webhooks signature (`SEND_SMS_HOOK_SECRET`) | Delivers the phone OTP via `SmsProvider`. Payload `{ user: { phone }, sms: { otp } }`. Returns `{}` or `{ error: { http_code, message } }` |
| `GET /business/{slug}/qr` | Browser | Same visibility as the page (published, or the business's team) | PNG QR code (1024 px) pointing at the business page, as a download |
| `GET /auth/callback?code=…&next=…` | Browser (email confirmation link) | PKCE code | Exchanges the code for a session cookie, then redirects to a same-site `next` |
