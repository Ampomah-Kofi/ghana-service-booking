import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/server/env";

const valid = {
  APP_ENV: "local",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_y",
  SEND_SMS_HOOK_SECRET: "v1,whsec_dGVzdA==",
  SMS_PROVIDER: "mock",
  DEFAULT_COUNTRY_CODE: "GH",
};

describe("parseServerEnv", () => {
  it("accepts a valid local environment", () => {
    expect(parseServerEnv(valid).DEFAULT_COUNTRY_CODE).toBe("GH");
  });
  it("refuses mock providers in production", () => {
    expect(() => parseServerEnv({ ...valid, APP_ENV: "production" })).toThrow(/Mock providers are not allowed/);
  });
  it("defaults WhatsApp and email to mocks locally, and names each mock in production", () => {
    expect(parseServerEnv(valid)).toMatchObject({ WHATSAPP_PROVIDER: "mock", EMAIL_PROVIDER: "mock" });
    expect(() => parseServerEnv({ ...valid, APP_ENV: "production" })).toThrow(/WHATSAPP_PROVIDER/);
    expect(() => parseServerEnv({ ...valid, APP_ENV: "production" })).toThrow(/EMAIL_PROVIDER/);
  });
  it("lets production switch WhatsApp and email off, but never SMS (phone sign-in needs it)", () => {
    const prod = { ...valid, APP_ENV: "production", WHATSAPP_PROVIDER: "none", EMAIL_PROVIDER: "none" };
    let message = "";
    try {
      parseServerEnv(prod);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toMatch(/SMS_PROVIDER/);
    expect(message).not.toMatch(/WHATSAPP_PROVIDER|EMAIL_PROVIDER/);
    expect(parseServerEnv({ ...valid, WHATSAPP_PROVIDER: "none" }).WHATSAPP_PROVIDER).toBe("none");
  });
  it("wants a long dispatcher secret when one is set", () => {
    expect(() => parseServerEnv({ ...valid, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
    expect(parseServerEnv({ ...valid, CRON_SECRET: "x".repeat(40) }).CRON_SECRET).toHaveLength(40);
  });
  it("reports missing variables by name", () => {
    expect(() => parseServerEnv({ ...valid, SUPABASE_SECRET_KEY: undefined })).toThrow(/SUPABASE_SECRET_KEY/);
  });
  it("rejects a secret key equal to the publishable key", () => {
    expect(() => parseServerEnv({ ...valid, SUPABASE_SECRET_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY })).toThrow(
      /must differ/,
    );
  });
  it("rejects malformed hook secrets and unknown countries", () => {
    expect(() => parseServerEnv({ ...valid, SEND_SMS_HOOK_SECRET: "plain" })).toThrow(/SEND_SMS_HOOK_SECRET/);
    expect(() => parseServerEnv({ ...valid, DEFAULT_COUNTRY_CODE: "XX" })).toThrow(/DEFAULT_COUNTRY_CODE/);
  });
});
