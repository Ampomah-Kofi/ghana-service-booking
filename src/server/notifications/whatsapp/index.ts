import "server-only";
import { serverEnv } from "@/server/env";
import { MockWhatsAppProvider } from "./mock-whatsapp-provider";
import type { WhatsAppProvider } from "./provider";

let instance: WhatsAppProvider | null | undefined;

/** The configured WhatsApp provider. serverEnv() refuses "mock" in production; null when switched off. */
export function getWhatsAppProvider(): WhatsAppProvider | null {
  if (instance !== undefined) return instance;
  switch (serverEnv().WHATSAPP_PROVIDER) {
    case "mock":
      instance = new MockWhatsAppProvider();
      return instance;
    case "none":
      instance = null;
      return instance;
  }
}
