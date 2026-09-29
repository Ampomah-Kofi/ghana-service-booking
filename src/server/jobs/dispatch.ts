import "server-only";
import { publicEnv } from "@/lib/public-env";
import { renderNotification, type NotificationPayload } from "@/lib/notification-templates";
import { createAdminClient } from "@/server/privileged/supabase-admin";
import { getEmailProvider } from "@/server/notifications/email";
import { getSmsProvider } from "@/server/notifications/sms";
import { getWhatsAppProvider } from "@/server/notifications/whatsapp";

export type DispatchResult = { claimed: number; sent: number; retrying: number; failed: number };

type Outcome =
  { ok: true; provider: string; id: string } | { ok: false; provider: string; error: string; retryable: boolean };

/**
 * Sends due notifications (ADR-0006): claim a batch (FOR UPDATE SKIP LOCKED, so parallel runs never
 * double-send), render each template, hand it to the channel's provider, record the outcome.
 * Runs with the secret key because it must see everyone's outbox; called only by the internal job route.
 */
export async function dispatchDueNotifications(limit = 50): Promise<DispatchResult> {
  const db = createAdminClient();
  const { data: rows, error } = await db.rpc("claim_notifications", { p_limit: limit });
  if (error) throw new Error(`claim_notifications failed: ${error.message}`);
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const result: DispatchResult = { claimed: rows.length, sent: 0, retrying: 0, failed: 0 };

  for (const n of rows) {
    const r = renderNotification(n.template_key, (n.payload ?? {}) as NotificationPayload, site);
    const to = n.recipient_address ?? "";
    let outcome: Outcome;
    try {
      if (n.channel === "sms") {
        const res = await getSmsProvider().send({ to, body: r.text, purpose: n.template_key });
        outcome = res.ok
          ? { ok: true, provider: getSmsProvider().id, id: res.providerMessageId }
          : { ok: false, provider: getSmsProvider().id, error: res.error, retryable: res.retryable };
      } else if (n.channel === "whatsapp") {
        // WhatsApp switched off: the same short text goes by SMS, so the person still hears.
        const provider = getWhatsAppProvider() ?? getSmsProvider();
        const res = await provider.send({ to, body: r.text, purpose: n.template_key });
        outcome = res.ok
          ? { ok: true, provider: provider.id, id: res.providerMessageId }
          : { ok: false, provider: provider.id, error: res.error, retryable: res.retryable };
      } else if (n.channel === "email") {
        const email = getEmailProvider();
        if (!email) {
          // Email switched off: nothing to send (the in-app inbox has the message).
          outcome = { ok: false, provider: "none", error: "email is switched off", retryable: false };
        } else {
          const res = await email.send({ to, subject: r.email.subject, text: r.email.text, purpose: n.template_key });
          outcome = res.ok
            ? { ok: true, provider: email.id, id: res.providerMessageId }
            : { ok: false, provider: email.id, error: res.error, retryable: res.retryable };
        }
      } else {
        outcome = { ok: false, provider: "none", error: `channel ${n.channel} is not dispatched`, retryable: false };
      }
    } catch (e) {
      // A thrown error (network, vendor outage) is worth retrying; the back-off limits the damage.
      outcome = {
        ok: false,
        provider: n.channel,
        error: e instanceof Error ? e.message : "send failed",
        retryable: true,
      };
    }

    const { error: finishError } = await db.rpc("finish_notification", {
      p_id: n.id,
      p_ok: outcome.ok,
      p_provider: outcome.provider,
      p_message_id: (outcome.ok ? outcome.id : null) as string,
      p_error: (outcome.ok ? null : outcome.error) as string,
      p_retryable: outcome.ok ? false : outcome.retryable,
    });
    if (finishError) console.error("[dispatch] finish_notification", n.id, finishError.message);
    if (outcome.ok) result.sent += 1;
    else if (outcome.retryable && n.attempts < 4) result.retrying += 1;
    else result.failed += 1;
  }
  return result;
}
