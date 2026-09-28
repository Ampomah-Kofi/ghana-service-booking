"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { checkedOf } from "@/lib/form-values";
import type { FormState } from "@/server/actions";
import { savePaymentRulesAction } from "@/app/dashboard/[businessId]/payments/actions";

type Values = { collectDepositsOnline: boolean; allowFullPaymentOnline: boolean; refundDepositOnNoShow: boolean };

/** Online payment switches. Off by default: every booking is "just book, pay at the visit". */
export function PaymentRulesForm({
  businessId,
  values,
  canTurnOn,
}: {
  businessId: string;
  values: Values;
  /** False until payout details exist (the database also refuses). */
  canTurnOn: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(savePaymentRulesAction, {});
  const onlineOff = !canTurnOn && !values.collectDepositsOnline && !values.allowFullPaymentOnline;
  const rows: { name: keyof Values; label: string; hint: string; online: boolean }[] = [
    {
      name: "collectDepositsOnline",
      label: "Take deposits online",
      hint: "For services with a deposit, customers pay it when they book. The time is held for 15 minutes while they pay.",
      online: true,
    },
    {
      name: "allowFullPaymentOnline",
      label: "Let customers pay in full online",
      hint: "Optional. Otherwise they pay the rest at the visit.",
      online: true,
    },
    {
      name: "refundDepositOnNoShow",
      label: "Refund the deposit on a no-show",
      hint: "Off: you keep the deposit if they don't come or cancel late. Customers see this before paying.",
      online: false,
    },
  ];
  return (
    <form action={formAction} className="rounded-card bg-card lift">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="px-4 pt-3 empty:hidden">
        <FormMessage tone="notice" message={state.notice} />
        <FormMessage tone="error" message={state.message} />
      </div>
      <div className="ios-list">
        {rows.map((row) => {
          const disabled = row.online && onlineOff;
          return (
            <label
              key={row.name}
              className={`flex min-h-14 items-center justify-between gap-4 px-4 py-3 ${disabled ? "opacity-60" : ""}`}
            >
              <span className="min-w-0">
                <span className="block text-body">{row.label}</span>
                <span className="block text-small text-ink-muted">{row.hint}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                name={row.name}
                disabled={disabled}
                defaultChecked={checkedOf(state.values, row.name, values[row.name])}
              />
            </label>
          );
        })}
      </div>
      <div className="border-t border-border px-4 py-3">
        <SubmitButton pendingLabel="Saving…" variant="secondary">
          Save payment settings
        </SubmitButton>
      </div>
    </form>
  );
}
