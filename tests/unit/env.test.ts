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
