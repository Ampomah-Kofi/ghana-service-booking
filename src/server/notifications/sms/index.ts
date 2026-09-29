import "server-only";
import { serverEnv } from "@/server/env";
import { ArkeselSmsProvider } from "./arkesel-sms-provider";
import { MockSmsProvider } from "./mock-sms-provider";
import type { SmsProvider } from "./provider";

let instance: SmsProvider | undefined;

/** Returns the configured SMS provider. serverEnv() already refuses "mock" in production. */
export function getSmsProvider(): SmsProvider {
  if (instance) return instance;
  const env = serverEnv();
  switch (env.SMS_PROVIDER) {
    case "mock":
      instance = new MockSmsProvider();
      return instance;
    case "arkesel":
      // Presence of both values is checked by serverEnv() when SMS_PROVIDER=arkesel.
      instance = new ArkeselSmsProvider({
        apiKey: env.ARKESEL_API_KEY ?? "",
        senderId: env.ARKESEL_SENDER_ID ?? "",
        sandbox: env.ARKESEL_SANDBOX,
      });
      return instance;
  }
}
