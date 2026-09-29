import "server-only";
import { serverEnv } from "@/server/env";
import { MockEmailProvider } from "./mock-email-provider";
import type { EmailProvider } from "./provider";

let instance: EmailProvider | null | undefined;

/** The configured email provider. serverEnv() refuses "mock" in production; null when switched off. */
export function getEmailProvider(): EmailProvider | null {
  if (instance !== undefined) return instance;
  switch (serverEnv().EMAIL_PROVIDER) {
    case "mock":
      instance = new MockEmailProvider();
      return instance;
    case "none":
      instance = null;
      return instance;
  }
}
