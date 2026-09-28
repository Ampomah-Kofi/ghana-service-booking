import "server-only";
import { serverEnv } from "@/server/env";
import { MockEmailProvider } from "./mock-email-provider";
import type { EmailProvider } from "./provider";

let instance: EmailProvider | undefined;

/** The configured email provider. serverEnv() refuses "mock" in production. */
export function getEmailProvider(): EmailProvider {
  if (instance) return instance;
  switch (serverEnv().EMAIL_PROVIDER) {
    case "mock":
      instance = new MockEmailProvider();
      return instance;
  }
}
