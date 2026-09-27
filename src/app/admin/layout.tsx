import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/server/auth/roles";
import { requireUserOrRedirect } from "@/server/auth/session";

/** Admin area: 404 for everyone who isn't a platform admin (don't reveal it exists). */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUserOrRedirect("/admin/categories");
  if (!(await isPlatformAdmin())) notFound();
  return (
    <div>
      <p className="mb-2 text-heading font-semibold text-ink">Admin</p>
      {children}
    </div>
  );
}
