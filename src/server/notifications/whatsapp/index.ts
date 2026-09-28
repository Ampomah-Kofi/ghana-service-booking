import "server-only";
import { serverEnv } from "@/server/env";
import { MockWhatsAppProvider } from "./mock-whatsapp-provider";
import type { WhatsAppProvider } from "./provider";

let instance: WhatsAppProvider | undefined;

/** The configured WhatsApp provider. serverEnv() refuses "mock" in production. */
export function getWhatsAppProvider(): WhatsAppProvider {
  if (instance) return instance;
  switch (serverEnv().WHATSAPP_PROVIDER) {
    case "mock":
      instance = new MockWhatsAppProvider();
      return instance;
  }
}
