import "server-only";
import { serverEnv } from "@/server/env";
import { MockSmsProvider } from "./mock-sms-provider";
import type { SmsProvider } from "./provider";

let instance: SmsProvider | undefined;

/** Returns the configured SMS provider. serverEnv() already refuses "mock" in production. */
export function getSmsProvider(): SmsProvider {
  if (instance) return instance;
  const { SMS_PROVIDER } = serverEnv();
  switch (SMS_PROVIDER) {
    case "mock":
      instance = new MockSmsProvider();
      return instance;
  }
}
