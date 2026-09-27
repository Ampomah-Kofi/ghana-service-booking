import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteForm, RemoveStaffForm, StaffForm, StaffHoursForm } from "@/components/business/staff-forms";
import { formatPhoneInternational } from "@/lib/phone";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listServices } from "@/server/businesses/catalog";
import { listStaff } from "@/server/businesses/team";
import { revokeInviteAction } from "../actions";

export const metadata: Metadata = { title: "Team member" };

export default async function StaffPage({ params, searchParams }: PageProps<"/dashboard/[businessId]/team/[staffId]">) {
  const { businessId, staffId } = await params;
  const { added } = await searchParams;
  const { db, business, role } = await managedBusinessOr404(businessId);
  const [staff, services] = await Promise.all([
    listStaff(db, business.id, { withInvites: true }),
    listServices(db, business.id),
  ]);
  const member = staff.find((s) => s.id === staffId);
  if (!member) notFound();
  const heading = "mb-2 mt-8 px-4 text-heading font-semibold text-ink";

  return (
    <>
      <h1 className="mb-4 text-display font-bold tracking-tight">{member.displayName}</h1>
      {added ? (
        <p role="status" className="mb-4 rounded-control bg-success/10 px-3 py-2 text-small text-success">
          Added. Set their hours below, and invite them if they should see their own bookings.
        </p>
      ) : null}
      <StaffForm
        businessId={business.id}
        staffId={member.id}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        values={{
          displayName: member.displayName,
          roleTitle: member.roleTitle ?? "",
          bio: member.bio ?? "",
          acceptsOnlineBookings: member.acceptsOnlineBookings,
          serviceIds: member.serviceIds,
        }}
      />

      <h2 className={heading}>Working hours</h2>
      <StaffHoursForm
        businessId={business.id}
        staffId={member.id}
        usesBusinessHours={member.usesBusinessHours}
        hours={member.hours}
      />

      <h2 className={heading}>Account</h2>
      {member.userId ? (
        <p className="rounded-card bg-card p-4 text-body border border-border">
          Linked to their account. They can sign in and see their bookings.
        </p>
      ) : member.pendingInvite ? (
        <div className="rounded-card bg-card p-4 border border-border">
          <p className="text-body">
            Invite sent to {formatPhoneInternational(member.pendingInvite.phone)}. It expires{" "}
            {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: business.timezone }).format(
              new Date(member.pendingInvite.expiresAt),
            )}
            .
          </p>
          <form action={revokeInviteAction}>
            <input type="hidden" name="businessId" value={business.id} />
            <input type="hidden" name="staffId" value={member.id} />
            <button type="submit" className="mt-1 min-h-11 text-small font-medium text-danger">
              Cancel invite
            </button>
          </form>
        </div>
      ) : (
        <InviteForm businessId={business.id} staffId={member.id} canInviteManager={role === "owner"} />
      )}

      <div className="mt-8">
        <RemoveStaffForm businessId={business.id} staffId={member.id} name={member.displayName} />
      </div>
    </>
  );
}
