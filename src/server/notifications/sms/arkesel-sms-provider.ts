import "server-only";
import type { SmsMessage, SmsProvider, SmsSendResult } from "./provider";

/**
 * Arkesel SMS (Ghana), written from Arkesel's official OpenAPI spec v2.4.0
 * (https://developers.arkesel.com, spec/api_spec.v2.4.0.yaml → POST /api/v2/sms/send):
 *
 * - URL: https://sms.arkesel.com/api/v2/sms/send, JSON body, API key in the `api-key` header
 *   (never in the URL, so it can't end up in logs).
 * - Body: `sender` (Sender ID, 1–11 characters), `recipients` (numbers like "233544919953"),
 *   `message`; optional `sandbox: true` = accepted and shown in the SMS history, not delivered or billed.
 * - 200: `{ status: "success", data: [{ recipient, id }, …, { "invalid numbers": [...] }] }`.
 * - Errors: `{ status: "error", message }` with 402 (insufficient balance or invalid coverage),
 *   403 (inactive gateway), 422 (validation), 500 (request failed).
 */
export const ARKESEL_SEND_URL = "https://sms.arkesel.com/api/v2/sms/send";

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type ArkeselOptions = {
  apiKey: string;
  senderId: string;
  /** Free test mode: Arkesel records the message but doesn't deliver it. */
  sandbox?: boolean;
  /** For tests. Defaults to the global fetch. */
  fetch?: FetchLike;
  timeoutMs?: number;
};

type ArkeselEntry = { recipient?: string; id?: string; "invalid numbers"?: string[] };
type ArkeselBody = { status?: string; message?: string; data?: ArkeselEntry[] };

export class ArkeselSmsProvider implements SmsProvider {
  readonly id = "arkesel";
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: ArkeselOptions) {
    if (!options.apiKey) throw new Error("ArkeselSmsProvider needs an API key");
    if (options.senderId.length < 1 || options.senderId.length > 11) {
      throw new Error("Arkesel Sender IDs are 1–11 characters");
    }
    this.fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
  }

  async send(message: SmsMessage): Promise<SmsSendResult> {
    // Arkesel's examples use international numbers without "+" (e.g. "233544919953").
    const recipient = message.to.replace(/^\+/, "");
    let res: Response;
    try {
      res = await this.fetchImpl(ARKESEL_SEND_URL, {
        method: "POST",
        headers: { "api-key": this.options.apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: this.options.senderId,
          message: message.body,
          recipients: [recipient],
          ...(this.options.sandbox ? { sandbox: true } : {}),
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      });
    } catch (e) {
      // Network failure or timeout: worth another try.
      return { ok: false, retryable: true, error: `arkesel: ${e instanceof Error ? e.name : "network error"}` };
    }

    const body = (await res.json().catch(() => null)) as ArkeselBody | null;
    if (!res.ok || body?.status !== "success") {
      const reason = body?.message ? `${res.status} ${body.message}` : `HTTP ${res.status}`;
      // 402 balance/coverage, 403 inactive gateway, 422 bad request: retrying won't help until someone fixes it.
      // 5xx and 429: temporary, retry with back-off.
      return { ok: false, retryable: res.status >= 500 || res.status === 429, error: `arkesel: ${reason}` };
    }

    const data = Array.isArray(body.data) ? body.data : [];
    const invalid = data.flatMap((d) => d["invalid numbers"] ?? []);
    if (invalid.includes(recipient)) {
      return { ok: false, retryable: false, error: "arkesel: invalid number" };
    }
    const sent = data.find((d) => d.recipient === recipient && d.id) ?? data.find((d) => d.id);
    return { ok: true, providerMessageId: sent?.id ?? "arkesel:accepted" };
  }
}
