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
      <nav aria-label="Admin" className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex w-max items-center gap-2">
          <li className="pr-1 text-heading font-semibold text-ink">Admin</li>
          {[
            ["/admin", "Overview"],
            ["/admin/businesses", "Businesses"],
            ["/admin/users", "People"],
            ["/admin/verification", "Verification"],
            ["/admin/reviews", "Reviews"],
            ["/admin/categories", "Categories"],
            ["/admin/audit", "Audit log"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-10 items-center rounded-full bg-fill px-3.5 text-small font-medium whitespace-nowrap text-ink hover:bg-ink/10"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
