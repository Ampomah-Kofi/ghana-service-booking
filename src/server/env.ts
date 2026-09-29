import "server-only";
import { isSupportedCountry, type CountryCode } from "libphonenumber-js/max";
import { z } from "zod";

/**
 * Server-only environment, validated once at first use. Fails fast with a
 * readable message instead of undefined behaviour deep inside a request.
 * Public (NEXT_PUBLIC_*) values live in src/lib/public-env.ts.
 */
// WhatsApp and email can be switched off ("none"): WhatsApp messages then go by SMS, emails are skipped
// (the in-app inbox always has them). SMS can't be off: phone sign-in needs it.
const optionalChannel = z.enum(["mock", "none"]);

export const serverEnvSchema = z
  .object({
    APP_ENV: z.enum(["local", "test", "staging", "production"]),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SEND_SMS_HOOK_SECRET: z
      .string()
      .regex(/^v1,whsec_[A-Za-z0-9+/=]+$/, "expected Standard Webhooks format v1,whsec_<base64>"),
    // SMS: "arkesel" (Ghana, docs/deployment.md) or the local mock.
    SMS_PROVIDER: z.enum(["mock", "arkesel"]),
    ARKESEL_API_KEY: z.string().min(8).optional(),
    ARKESEL_SENDER_ID: z.string().min(1).max(11, "Arkesel Sender IDs are at most 11 characters").optional(),
    // "true" = Arkesel sandbox: messages are accepted and logged in Arkesel's history, not delivered or billed.
    ARKESEL_SANDBOX: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Phase 8 channels. Optional locally (default mock); production must name a real provider.
    WHATSAPP_PROVIDER: optionalChannel.default("mock"),
    EMAIL_PROVIDER: optionalChannel.default("mock"),
    // Bearer secret for /api/internal/jobs/dispatch (pg_cron → pg_net). Unset = the dispatcher refuses.
    CRON_SECRET: z.string().min(32, "use at least 32 random characters").optional(),
    DEFAULT_COUNTRY_CODE: z.custom<CountryCode>(
      (v) => typeof v === "string" && isSupportedCountry(v),
      "expected an ISO 3166-1 alpha-2 code supported by libphonenumber",
    ),
  })
  .superRefine((env, ctx) => {
    if (env.SMS_PROVIDER === "arkesel") {
      for (const key of ["ARKESEL_API_KEY", "ARKESEL_SENDER_ID"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required when SMS_PROVIDER=arkesel" });
      }
    }
    if (env.APP_ENV === "production") {
      for (const key of ["SMS_PROVIDER", "WHATSAPP_PROVIDER", "EMAIL_PROVIDER"] as const) {
        if (env[key] === "mock") {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Mock providers are not allowed when APP_ENV=production",
          });
        }
      }
    }
    if (env.SUPABASE_SECRET_KEY === env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_SECRET_KEY"],
        message: "secret key must differ from the publishable key",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${details}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
