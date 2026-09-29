import { describe, expect, it } from "vitest";
import { ARKESEL_SEND_URL, ArkeselSmsProvider } from "@/server/notifications/sms/arkesel-sms-provider";

/**
 * The Arkesel adapter against the documented contract (OpenAPI spec v2.4.0, POST /api/v2/sms/send),
 * with a fake fetch: no network, no real key.
 */
type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { calls, fetch };
}

const msg = { to: "+233544919953", body: "Booker GH: your code is 123456", purpose: "auth.otp" };

describe("ArkeselSmsProvider", () => {
  it("posts JSON to the v2 endpoint with the key in a header, never in the URL", async () => {
    const f = fakeFetch(200, { status: "success", data: [{ recipient: "233544919953", id: "9b75-2841" }] });
    const p = new ArkeselSmsProvider({ apiKey: "test-key-123", senderId: "BookerGH", fetch: f.fetch });
    expect(await p.send(msg)).toEqual({ ok: true, providerMessageId: "9b75-2841" });

    const [call] = f.calls;
    expect(call.url).toBe(ARKESEL_SEND_URL);
    expect(call.url).not.toContain("test-key-123");
    expect(call.init.method).toBe("POST");
    expect((call.init.headers as Record<string, string>)["api-key"]).toBe("test-key-123");
    expect(JSON.parse(String(call.init.body))).toEqual({
      sender: "BookerGH",
      message: "Booker GH: your code is 123456",
      recipients: ["233544919953"],
    });
  });

  it("adds sandbox: true in test mode (accepted by Arkesel, not delivered or billed)", async () => {
    const f = fakeFetch(200, { status: "success", data: [{ recipient: "233544919953", id: "x1" }] });
    await new ArkeselSmsProvider({ apiKey: "test-key-123", senderId: "BookerGH", sandbox: true, fetch: f.fetch }).send(
      msg,
    );
    expect(JSON.parse(String(f.calls[0].init.body)).sandbox).toBe(true);
  });

  it("treats balance, gateway and validation errors as final, and server errors as retryable", async () => {
    const cases: [number, string, boolean][] = [
      [402, "Insufficient balance or invalid coverage!", false],
      [403, "Inactive SMS Gateway!", false],
      [422, "The message field is required.", false],
      [500, "SMS request failed!", true],
    ];
    for (const [status, message, retryable] of cases) {
      const f = fakeFetch(status, { status: "error", message });
      const r = await new ArkeselSmsProvider({ apiKey: "test-key-123", senderId: "BookerGH", fetch: f.fetch }).send(
        msg,
      );
      expect(r).toEqual({ ok: false, retryable, error: `arkesel: ${status} ${message}` });
    }
  });

  it("reports a number Arkesel lists as invalid", async () => {
    const f = fakeFetch(200, { status: "success", data: [{ "invalid numbers": ["233544919953"] }] });
    const r = await new ArkeselSmsProvider({ apiKey: "test-key-123", senderId: "BookerGH", fetch: f.fetch }).send(msg);
    expect(r).toEqual({ ok: false, retryable: false, error: "arkesel: invalid number" });
  });

  it("retries after a network failure or timeout, without leaking the key in the error", async () => {
    const p = new ArkeselSmsProvider({
      apiKey: "test-key-123",
      senderId: "BookerGH",
      fetch: async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      },
    });
    const r = await p.send(msg);
    expect(r).toEqual({ ok: false, retryable: true, error: "arkesel: TimeoutError" });
    expect(JSON.stringify(r)).not.toContain("test-key-123");
  });

  it("refuses a Sender ID longer than Arkesel's 11 characters", () => {
    expect(() => new ArkeselSmsProvider({ apiKey: "test-key-123", senderId: "BookerGhanaApp" })).toThrow(/1–11/);
  });
});
