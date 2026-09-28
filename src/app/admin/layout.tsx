import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/server/auth/roles";
import { requireUserOrRedirect } from "@/server/auth/session";

/** Admin area: 404 for everyone who isn't a platform admin (don't reveal it exists). */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUserOrRedirect("/admin");
  if (!(await isPlatformAdmin())) notFound();
  return (
    <div>
      <nav aria-label="Admin" className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-heading font-semibold text-ink">Admin</p>
        {[
          ["/admin", "Overview"],
          ["/admin/businesses", "Businesses"],
          ["/admin/users", "People"],
          ["/admin/verification", "Verification"],
          ["/admin/reviews", "Reviews"],
          ["/admin/categories", "Categories"],
          ["/admin/audit", "Audit log"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="min-h-11 content-center text-small font-medium text-primary">
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
