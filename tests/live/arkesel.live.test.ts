import { describe, expect, it } from "vitest";
import { ArkeselSmsProvider } from "@/server/notifications/sms/arkesel-sms-provider";

/**
 * One real request to Arkesel (opt-in, never in CI). Needs ARKESEL_API_KEY, ARKESEL_SENDER_ID and
 * ARKESEL_TEST_TO (your own number, e.g. +233241234567). Sandbox by default: Arkesel accepts and logs
 * the message but doesn't deliver or bill it. Set ARKESEL_LIVE=1 to actually deliver one SMS.
 */
const { ARKESEL_API_KEY, ARKESEL_SENDER_ID, ARKESEL_TEST_TO, ARKESEL_LIVE } = process.env;
const ready = Boolean(ARKESEL_API_KEY && ARKESEL_SENDER_ID && ARKESEL_TEST_TO);

describe.skipIf(!ready)("Arkesel (live)", () => {
  it("accepts a message from our Sender ID", async () => {
    const provider = new ArkeselSmsProvider({
      apiKey: ARKESEL_API_KEY!,
      senderId: ARKESEL_SENDER_ID!,
      sandbox: ARKESEL_LIVE !== "1",
    });
    const started = Date.now();
    const result = await provider.send({
      to: ARKESEL_TEST_TO!,
      body: "Booker GH test: SMS is working. No action needed.",
      purpose: "test.live",
    });
    console.info(
      `[arkesel live] ${ARKESEL_LIVE === "1" ? "delivered" : "sandbox"} request answered in ${Date.now() - started} ms:`,
      result.ok ? `accepted, id ${result.providerMessageId}` : `refused, ${result.error}`,
    );
    expect(result.ok).toBe(true);
  });
});
