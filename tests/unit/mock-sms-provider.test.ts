import { describe, expect, it, vi } from "vitest";
import { MockSmsProvider } from "@/server/notifications/sms/mock-sms-provider";

describe("MockSmsProvider", () => {
  it("records messages and never reports failure", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const provider = new MockSmsProvider();
    const result = await provider.send({ to: "+233241234567", body: "Your code is 123456", purpose: "auth.otp" });
    expect(result.ok).toBe(true);
    expect(provider.sent).toHaveLength(1);
    expect(provider.id).toBe("mock-sms");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("[MockSmsProvider]"));
    log.mockRestore();
  });
});
