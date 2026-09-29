"use client";

/** "Shows: <service>" under a portfolio photo. Saves on change; a Save button for when JavaScript is off. */
export function PhotoServiceSelect({
  action,
  businessId,
  photoId,
  current,
  services,
}: {
  action: (formData: FormData) => Promise<void>;
  businessId: string;
  photoId: string;
  current: string | null;
  services: { id: string; name: string }[];
}) {
  return (
    <form action={action} className="mt-1.5">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="photoId" value={photoId} />
      <label htmlFor={`svc-${photoId}`} className="sr-only">
        Which service does this photo show?
      </label>
      <select
        id={`svc-${photoId}`}
        name="serviceId"
        defaultValue={current ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="block min-h-9 w-full truncate rounded-inner bg-fill px-2 text-caption font-medium text-ink"
      >
        <option value="">No service</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="mt-1 text-caption font-semibold text-primary">
          Save
        </button>
      </noscript>
    </form>
  );
}
