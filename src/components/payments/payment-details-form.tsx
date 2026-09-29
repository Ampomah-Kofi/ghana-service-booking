"use client";

import { useActionState } from "react";
import { Field, FormMessage, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import { MOMO_NETWORKS } from "@/lib/payment-methods";
import type { FormState } from "@/server/actions";
import { savePaymentDetailsAction } from "@/app/dashboard/[businessId]/payments/actions";

type Values = {
  momoNetwork: string;
  momoNumber: string;
  momoName: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
};

/**
 * Where customers send money when they choose Mobile Money or bank transfer. Shown only to
 * customers who booked, on their own booking. Leave a side empty if you don't use it.
 */
export function PaymentDetailsForm({
  businessId,
  values,
  canEdit,
}: {
  businessId: string;
  values: Values;
  /** Only the owner changes these; managers see them. */
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(savePaymentDetailsAction, {});
  const e = state.fieldErrors ?? {};
  const v = (k: keyof Values) => valueOf(state.values, k, values[k]);
  return (
    <form action={formAction} noValidate className="grid grid-cols-[minmax(0,1fr)] p-4">
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.fieldErrors || state.ok ? undefined : state.message} />
      <fieldset disabled={!canEdit} className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
        <legend className="mb-2 text-body font-semibold">Mobile Money</legend>
        <SelectField
          id="momoNetwork"
          name="momoNetwork"
          label="Network"
          defaultValue={v("momoNetwork") || "mtn"}
          error={e.momoNetwork}
        >
          {Object.entries(MOMO_NETWORKS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <Field
          id="momoNumber"
          name="momoNumber"
          type="tel"
          inputMode="tel"
          label="Mobile Money number"
          placeholder="024 123 4567"
          defaultValue={v("momoNumber")}
          error={e.momoNumber}
        />
        <Field
          id="momoName"
          name="momoName"
          label="Name on the wallet"
          hint="Customers check this name before sending."
          defaultValue={v("momoName")}
          error={e.momoName}
        />
      </fieldset>
      <fieldset disabled={!canEdit} className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)]">
        <legend className="mb-2 text-body font-semibold">Bank account</legend>
        <Field
          id="bankName"
          name="bankName"
          label="Bank"
          placeholder="e.g. GCB Bank"
          defaultValue={v("bankName")}
          error={e.bankName}
        />
        <Field
          id="bankAccountName"
          name="bankAccountName"
          label="Account name"
          defaultValue={v("bankAccountName")}
          error={e.bankAccountName}
        />
        <Field
          id="bankAccountNumber"
          name="bankAccountNumber"
          inputMode="numeric"
          label="Account number"
          defaultValue={v("bankAccountNumber")}
          error={e.bankAccountNumber}
        />
      </fieldset>
      {canEdit ? (
        <SubmitButton pendingLabel="Saving…">Save payment details</SubmitButton>
      ) : (
        <p className="text-small text-ink-muted">Only the owner can change these.</p>
      )}
    </form>
  );
}
