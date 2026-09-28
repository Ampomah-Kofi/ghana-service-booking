"use client";

import { useActionState, useState } from "react";
import { FormMessage, SelectField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { valueOf } from "@/lib/form-values";
import { MOMO_NETWORKS } from "@/schemas/payments";
import type { FormState } from "@/server/actions";

type Method = "mobile_money" | "card" | "bank_transfer";

const METHODS: { value: Method; label: string; hint: string }[] = [
  { value: "mobile_money", label: "Mobile Money", hint: "MTN MoMo, Telecel Cash, AirtelTigo Money" },
  { value: "card", label: "Card", hint: "Visa or Mastercard" },
  { value: "bank_transfer", label: "Bank transfer", hint: "Pay from your bank app" },
];

/** Choose how to pay (Phase 9). Mobile Money first: it's how most people pay in Ghana. */
export function PayForm({
  action,
  kind,
  amountLabel,
  defaultPhone,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  kind: "deposit" | "full";
  amountLabel: string;
  defaultPhone: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [method, setMethod] = useState<Method>(
    (valueOf(state.values, "method", "mobile_money") as Method) ?? "mobile_money",
  );
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <input type="hidden" name="kind" value={kind} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <legend className="mb-2 text-small font-medium">Pay with</legend>
        {METHODS.map((m) => (
          <label
            key={m.value}
            className={`pressable flex min-h-14 cursor-pointer items-center gap-3 rounded-card border-2 bg-card px-4 py-3 ${
              method === m.value ? "border-primary" : "border-transparent lift"
            }`}
          >
            <input
              type="radio"
              name="method"
              value={m.value}
              checked={method === m.value}
              onChange={() => setMethod(m.value)}
              className="size-5 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium">{m.label}</span>
              <span className="block text-small text-ink-muted">{m.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {method === "mobile_money" ? (
        <div className="rounded-card bg-card p-4 lift">
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
          <label htmlFor="phone" className="mb-1.5 block text-small font-medium">
            Mobile Money number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={valueOf(state.values, "phone", defaultPhone)}
            aria-invalid={e.phone ? true : undefined}
            aria-describedby={e.phone ? "phone-error" : "phone-hint"}
            className={`block min-h-12 w-full rounded-control border bg-card px-3 text-body outline-none focus:border-primary ${
              e.phone ? "border-danger" : "border-border"
            }`}
          />
          {e.phone ? (
            <p id="phone-error" role="alert" className="mt-1.5 text-small text-danger">
              {e.phone}
            </p>
          ) : (
            <p id="phone-hint" className="mt-1.5 text-small text-ink-muted">
              You&apos;ll get a prompt on this phone to approve {amountLabel}.
            </p>
          )}
        </div>
      ) : null}

      <SubmitButton pendingLabel="Starting…">Pay {amountLabel}</SubmitButton>
    </form>
  );
}
