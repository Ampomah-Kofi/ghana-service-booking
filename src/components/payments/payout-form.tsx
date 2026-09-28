"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import { MOMO_NETWORKS } from "@/schemas/payments";
import type { FormState } from "@/server/actions";
import { savePayoutAccountAction } from "@/app/dashboard/[businessId]/payments/actions";

type Method = "mobile_money" | "bank";

/**
 * The owner says where online payments should land: a Mobile Money wallet or a bank account.
 * Always entered in full (the saved number is never sent back to the browser).
 */
export function PayoutForm({ businessId, defaultName }: { businessId: string; defaultName: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(savePayoutAccountAction, {});
  const [method, setMethod] = useState<Method>(
    (valueOf(state.values, "method", "mobile_money") as Method) ?? "mobile_money",
  );
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-1 p-4">
      <input type="hidden" name="businessId" value={businessId} />
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <fieldset className="mb-4 grid grid-cols-2 gap-2">
        <legend className="mb-1.5 text-small font-medium">Get paid to</legend>
        {(
          [
            ["mobile_money", "Mobile Money"],
            ["bank", "Bank account"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className={`pressable flex min-h-12 cursor-pointer items-center gap-2 rounded-control border-2 px-3 ${
              method === value ? "border-primary bg-primary-soft" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="method"
              value={value}
              checked={method === value}
              onChange={() => setMethod(value)}
              className="size-5 accent-primary"
            />
            <span className="text-body font-medium">{label}</span>
          </label>
        ))}
      </fieldset>
      <Field
        id="accountName"
        name="accountName"
        label="Name on the account"
        autoComplete="name"
        defaultValue={valueOf(state.values, "accountName", defaultName)}
        hint="As registered with the network or bank."
        error={e.accountName}
      />
      {method === "mobile_money" ? (
        <>
          <SelectField
            id="network"
            name="network"
            label="Network"
            defaultValue={valueOf(state.values, "network", "mtn")}
            error={e.network}
          >
            {Object.entries(MOMO_NETWORKS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <Field
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            label="Mobile Money number"
            defaultValue={valueOf(state.values, "phone", "")}
            error={e.phone}
          />
        </>
      ) : (
        <>
          <Field
            id="bankName"
            name="bankName"
            label="Bank"
            placeholder="e.g. GCB Bank"
            defaultValue={valueOf(state.values, "bankName", "")}
            error={e.bankName}
          />
          <Field
            id="accountNumber"
            name="accountNumber"
            inputMode="numeric"
            label="Account number"
            defaultValue={valueOf(state.values, "accountNumber", "")}
            error={e.accountNumber}
          />
        </>
      )}
      <SubmitButton pendingLabel="Saving…">Save payout details</SubmitButton>
    </form>
  );
}
