/**
 * "Book again": straight to the time step with the same service and the same person.
 * If that person no longer takes the service, the booking flow falls back to "any available";
 * if the service is gone, it asks for a service again.
 */
export function rebookHref(slug: string, serviceId: string, staffId: string | null): string {
  const params = new URLSearchParams({ service: serviceId, ...(staffId ? { staff: staffId } : {}) });
  return `/business/${slug}/book?${params}`;
}
