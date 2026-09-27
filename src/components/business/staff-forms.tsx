"use client";

import { valueOf, checkedOf, listOf } from "@/lib/form-values";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, SelectField, TextAreaField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { HoursRange } from "@/lib/hours";
import type { FormState } from "@/server/actions";
import {
  inviteStaffAction,
  removeStaffAction,
  saveStaffAction,
  saveStaffHoursAction,
  type InviteState,
} from "@/app/dashboard/[businessId]/team/actions";
import { WeekHoursEditor } from "./week-hours-editor";

type StaffValues = {
  displayName: string;
  roleTitle: string;
  bio: string;
  acceptsOnlineBookings: boolean;
  serviceIds: string[];
};

export function StaffForm({
  businessId,
  staffId,
  services,
  values,
}: {
  businessId: string;
  staffId?: string;
  services: { id: string; name: string }[];
  values: StaffValues;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveStaffAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="rounded-card bg-surface-elevated p-5 shadow-card">
      <input type="hidden" name="businessId" value={businessId} />
      {staffId ? <input type="hidden" name="staffId" value={staffId} /> : null}
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <Field
        id="displayName"
        name="displayName"
        label="Name customers see"
        maxLength={80}
        defaultValue={valueOf(state.values, "displayName", values.displayName)}
        error={e.displayName}
      />
      <Field
        id="roleTitle"
        name="roleTitle"
        label="Role"
        placeholder="e.g. Senior stylist"
        maxLength={60}
        defaultValue={valueOf(state.values, "roleTitle", values.roleTitle)}
        hint="Optional."
        error={e.roleTitle}
      />
      <TextAreaField
        id="bio"
        name="bio"
        label="Short bio"
        rows={3}
        maxLength={1000}
        defaultValue={valueOf(state.values, "bio", values.bio)}
        hint="Optional."
        error={e.bio}
      />
      {services.length > 0 ? (
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-callout font-medium">Services they do</legend>
          {services.map((s) => (
            <label key={s.id} className="flex min-h-11 items-center gap-3 text-body">
              <input
                type="checkbox"
                name="serviceIds"
                value={s.id}
                defaultChecked={listOf(state.values, "serviceIds", values.serviceIds).includes(s.id)}
                className="size-5 accent-accent"
              />
              {s.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <label className="mb-5 flex min-h-11 items-center justify-between gap-3 text-body">
        <span>
          Customers can book them online
          <span className="block text-footnote text-text-secondary">Turn off for people who only take walk-ins.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          name="acceptsOnlineBookings"
          defaultChecked={checkedOf(state.values, "acceptsOnlineBookings", values.acceptsOnlineBookings)}
        />
      </label>
      <SubmitButton pendingLabel="Saving…">{staffId ? "Save changes" : "Add team member"}</SubmitButton>
    </form>
  );
}

export function StaffHoursForm({
  businessId,
  staffId,
  usesBusinessHours,
  hours,
}: {
  businessId: string;
  staffId: string;
  usesBusinessHours: boolean;
  hours: HoursRange[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveStaffHoursAction, {});
  const [useBusiness, setUseBusiness] = useState(usesBusinessHours);
  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="staffId" value={staffId} />
      <FormMessage tone="notice" message={state.notice} />
      <FormMessage tone="error" message={state.message} />
      <label className="mb-3 flex min-h-11 items-center justify-between gap-3 rounded-card bg-surface-elevated px-4 text-body shadow-card">
        Same as the business hours
        <input
          type="checkbox"
          role="switch"
          name="usesBusinessHours"
          checked={useBusiness}
          onChange={(ev) => setUseBusiness(ev.target.checked)}
        />
      </label>
      {useBusiness ? null : (
        <WeekHoursEditor
          name="hours"
          initial={hours.length ? hours : [2, 3, 4, 5, 6].map((d) => ({ weekday: d, opens: "09:00", closes: "17:00" }))}
        />
      )}
      <SubmitButton pendingLabel="Saving…" className="mt-4">
        Save working hours
      </SubmitButton>
    </form>
  );
}

export function InviteForm({
  businessId,
  staffId,
  canInviteManager,
}: {
  businessId: string;
  staffId: string;
  canInviteManager: boolean;
}) {
  const [state, formAction] = useActionState<InviteState, FormData>(inviteStaffAction, {});
  const [copied, setCopied] = useState(false);

  if (state.link) {
    const message = `You've been added to our team on Hyia. Open this link and sign in with ${state.phone} to accept: ${state.link}`;
    return (
      <div className="grid gap-3 rounded-card bg-surface-elevated p-5 shadow-card">
        <p className="text-body">
          Send this link to <strong>{state.phone}</strong>. It works once, only for that phone number, and expires in 7
          days.
        </p>
        <p className="break-all rounded-control bg-fill px-3 py-2 text-footnote">{state.link}</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/${state.phone?.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center rounded-control bg-accent px-3 text-body font-semibold text-on-accent"
          >
            Send on WhatsApp
          </a>
          <Button
            type="button"
            variant="plain"
            className="bg-fill"
            onClick={() =>
              navigator.clipboard.writeText(state.link ?? "").then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="rounded-card bg-surface-elevated p-5 shadow-card">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="staffId" value={staffId} />
      <FormMessage tone="error" message={state.fieldErrors ? undefined : state.message} />
      <Field
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        label="Their phone number"
        placeholder="024 123 4567"
        error={state.fieldErrors?.phone}
      />
      {canInviteManager ? (
        <SelectField
          id="role"
          name="role"
          label="Access"
          defaultValue={valueOf(state.values, "role", "staff")}
          hint="Managers can edit services, hours and the team."
        >
          <option value="staff">Staff: sees their own bookings</option>
          <option value="manager">Manager: runs the business with you</option>
        </SelectField>
      ) : (
        <input type="hidden" name="role" value="staff" />
      )}
      <SubmitButton pendingLabel="Creating link…">Create invite link</SubmitButton>
    </form>
  );
}

export function RemoveStaffForm({ businessId, staffId, name }: { businessId: string; staffId: string; name: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(removeStaffAction, {});
  const [confirming, setConfirming] = useState(false);
  return (
    <form action={formAction}>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="staffId" value={staffId} />
      <FormMessage tone="error" message={state.message} />
      {confirming ? (
        <div className="grid gap-2 rounded-card bg-surface-elevated p-4 shadow-card">
          <p className="text-body">
            Remove {name}? They&apos;ll disappear from your page and lose access. Past bookings are kept.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="plain" className="bg-fill" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <SubmitButton pendingLabel="Removing…" className="bg-danger hover:bg-danger">
              Remove
            </SubmitButton>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="plain"
          className="w-full rounded-card bg-surface-elevated text-danger shadow-card"
          onClick={() => setConfirming(true)}
        >
          Remove from team
        </Button>
      )}
    </form>
  );
}
