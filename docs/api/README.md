# API

## Public / mobile API: `/api/v1`
See [`v1.md`](./v1.md) and the live OpenAPI document at `/api/v1/openapi.json`. Endpoints so far: `GET /categories`, `GET /search`, `GET /businesses/{slug}`.

## Internal endpoints (not for clients)
| Method & path | Caller | Auth | Purpose |
|---|---|---|---|
| `POST /api/internal/auth/send-sms` | Supabase Auth (Send SMS Hook) | Standard Webhooks signature (`SEND_SMS_HOOK_SECRET`) | Delivers the phone OTP via `SmsProvider`. Payload `{ user: { phone }, sms: { otp } }`. Returns `{}` or `{ error: { http_code, message } }` |
| `GET /business/{slug}/qr` | Browser | Same visibility as the page (published, or the business's team) | PNG QR code (1024 px) pointing at the business page, as a download |
| `GET /invite/{token}` | Browser (link shared by a business owner) | Signed-in user whose verified phone matches the invite | Shows the invite and accepts it (`accept_staff_invite`) |
| `GET /auth/callback?code=…&next=…` | Browser (email confirmation link) | PKCE code | Exchanges the code for a session cookie, then redirects to a same-site `next` |
