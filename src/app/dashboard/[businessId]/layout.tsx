import Link from "next/link";
import { unreadCount } from "@/server/notifications/inbox";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ProviderTabs } from "@/components/business/provider-tabs";
import { memberBusinessOr404 } from "@/server/businesses/access";

/**
 * Any member may enter (staff see Today and their own calendar). Pages for owners and
 * managers check that themselves, and the database enforces it again.
 */
export default async function BusinessDashboardLayout({ children, params }: LayoutProps<"/dashboard/[businessId]">) {
  const { businessId } = await params;
  const { db, business, canManage } = await memberBusinessOr404(businessId);
  const unread = await unreadCount(db);

  return (
    <div className="pb-28 md:pb-0">
      <nav className="mb-4 flex items-center justify-between gap-3 text-small" aria-label="Business">
        <Link href={`/dashboard/${business.id}`} className="min-w-0 truncate font-semibold">
          {business.name}
        </Link>
        <span className="flex shrink-0 items-center gap-3">
          <Link href={`/business/${business.slug}`} className="font-medium text-primary">
            {business.status === "published" ? "View page" : "Preview"}
          </Link>
          <NotificationBell unread={unread} />
        </span>
      </nav>
      <ProviderTabs businessId={business.id} canManage={canManage} />
      {children}
    </div>
  );
}
