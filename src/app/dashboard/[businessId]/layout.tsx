import Link from "next/link";
import { managedBusinessOr404 } from "@/server/businesses/access";

export default async function BusinessDashboardLayout({ children, params }: LayoutProps<"/dashboard/[businessId]">) {
  const { businessId } = await params;
  const { business } = await managedBusinessOr404(businessId);

  return (
    <div>
      <nav className="mb-4 flex items-center justify-between gap-3 text-callout" aria-label="Business">
        <Link href={`/dashboard/${business.id}`} className="min-w-0 truncate font-semibold">
          {business.name}
        </Link>
        <Link href={`/business/${business.slug}`} className="shrink-0 font-medium text-accent">
          {business.status === "published" ? "View page" : "Preview"}
        </Link>
      </nav>
      {children}
    </div>
  );
}
