"use client";

import { useActionState, useEffect } from "react";
import { Field, FormMessage } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import { PAYMENT_METHOD_KEYS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";
import type { FormState } from "@/server/actions";
import { recordPaymentAction, refundPaymentAction } from "@/app/dashboard/[businessId]/payments/actions";

export type PaymentLine = {
  id: string;
  label: string;
  status: string;
  tone: string;
  amount: string;
  refundable: boolean;
  note: string | null;
};

/**
 * Money on one appointment, for the business (ADR-0017): how the customer said they'll pay, what's
 * been marked paid, and "Mark paid" once the business has the money (cash, MoMo, bank or card at
 * the shop). Nothing is charged through the app. Owners and managers see amounts and can record a
 * refund; staff only mark paid.
 */
export function AppointmentPayments({
  businessId,
  appointmentId,
  lines,
  summary,
  leftInput,
  currencySymbol,
  canRecord,
  canSeeMoney,
  defaultMethod,
  choiceLabel,
}: {
  businessId: string;
  appointmentId: string;
  lines: PaymentLine[];
  /** e.g. "GH₵ 20 paid · GH₵ 30 to collect". */
  summary: string | null;
  /** What's still owed, as the amount box's starting value ("30"). */
  leftInput: string;
  currencySymbol: string;
  canRecord: boolean;
  canSeeMoney: boolean;
  /** The customer's stated method, preselected in "Mark paid". */
  defaultMethod: PaymentMethod;
  /** "Customer will pay with Mobile Money", or null when they didn't say. */
  choiceLabel: string | null;
}) {
  const [recordState, recordAction] = useActionState<FormState, FormData>(recordPaymentAction, {});
  const [refundState, refundAction] = useActionState<FormState, FormData>(refundPaymentAction, {});
  const e = recordState.fieldErrors ?? {};
  const re = refundState.fieldErrors ?? {};
  const sheetId = `record-payment-${appointmentId}`;
  // Saved: close the sheet so the updated list shows.
  useEffect(() => {
    if (recordState.ok) document.getElementById(sheetId)?.hidePopover();
  }, [recordState, sheetId]);

  return (
    <section aria-labelledby="payments-heading" className="mt-4 overflow-hidden rounded-card bg-card lift">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2 id="payments-heading" className="text-heading font-semibold">
          Payment
        </h2>
        {canRecord ? (
          <button
            type="button"
            popoverTarget={sheetId}
            className="pressable min-h-11 rounded-full bg-primary-soft px-4 text-small font-semibold text-primary"
          >
            Mark paid
          </button>
        ) : null}
      </div>
      {choiceLabel ? <p className="px-5 pb-2 text-small text-ink-muted">{choiceLabel}</p> : null}
      <div className="px-5 empty:hidden">
        <FormMessage tone="notice" message={recordState.notice ?? refundState.notice} />
        <FormMessage
          tone="error"
          message={refundState.fieldErrors ? undefined : refundState.ok ? undefined : refundState.message}
        />
      </div>
      {canSeeMoney && lines.length > 0 ? (
        <ul className="ios-list">
          {lines.map((line) => (
            <li key={line.id} className="px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-body">{line.label}</span>
                  <span className={`block text-small ${line.tone}`}>{line.status}</span>
                  {line.note ? <span className="block text-small text-ink-muted">{line.note}</span> : null}
                </span>
                <span className="shrink-0 text-body font-semibold tabular-nums">{line.amount}</span>
              </div>
              {line.refundable ? (
                <details className="mt-1">
                  <summary className="min-h-11 cursor-pointer list-none content-center text-small font-medium text-danger">
                    Mark {line.amount} refunded
                  </summary>
                  <form action={refundAction} noValidate className="grid gap-2 pt-1">
                    <input type="hidden" name="businessId" value={businessId} />
                    <input type="hidden" name="appointmentId" value={appointmentId} />
                    <input type="hidden" name="paymentId" value={line.id} />
                    <Field
                      id={`refund-note-${line.id}`}
                      name="note"
                      label="Why? (the customer sees this)"
                      hint="Only records it. Give the money back to the customer yourself."
                      defaultValue={valueOf(refundState.values, "note", "")}
                      error={re.note}
                    />
                    <SubmitButton pendingLabel="Saving…" variant="danger">
                      Mark refunded
                    </SubmitButton>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="border-t border-border px-5 py-3 text-small text-ink-muted">
        {summary ??
          (canSeeMoney
            ? "Nothing marked paid yet. Tap Mark paid when you have the money."
            : "Tap Mark paid when you have the money.")}
      </p>

      {canRecord ? (
        <Sheet id={sheetId} title="Mark paid">
          <form action={recordAction} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-1">
            <input type="hidden" name="businessId" value={businessId} />
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <FormMessage
              tone="error"
              message={recordState.fieldErrors ? undefined : recordState.ok ? undefined : recordState.message}
            />
            <fieldset className="mb-4 grid grid-cols-2 gap-2">
              <legend className="mb-1.5 text-small font-medium">Paid with</legend>
              {PAYMENT_METHOD_KEYS.map((value) => (
                <label
                  key={value}
                  className="pressable flex min-h-12 cursor-pointer items-center gap-2 rounded-control border-2 border-border px-3 has-checked:border-primary has-checked:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="method"
                    value={value}
                    defaultChecked={valueOf(recordState.values, "method", defaultMethod) === value}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="text-body font-medium">{PAYMENT_METHODS[value].short}</span>
                </label>
              ))}
            </fieldset>
            {e.method ? (
              <p role="alert" className="-mt-2 mb-3 text-small text-danger">
                {e.method}
              </p>
            ) : null}
            <Field
              id={`amount-${appointmentId}`}
              name="amount"
              inputMode="decimal"
              label={`Amount received (${currencySymbol})`}
              defaultValue={valueOf(recordState.values, "amount", leftInput)}
              error={e.amount}
            />
            <Field
              id={`note-${appointmentId}`}
              name="note"
              label="Note (optional)"
              placeholder="e.g. MoMo transaction ID"
              defaultValue={valueOf(recordState.values, "note", "")}
              error={e.note}
            />
            <SubmitButton pendingLabel="Saving…">Mark paid</SubmitButton>
          </form>
        </Sheet>
      ) : null}
    </section>
  );
}
