import type { Metadata } from "next";
import { StepHeader } from "@/components/ui/step-header";
import { formatPhoneInternational } from "@/lib/phone";
import { getCurrentUser } from "@/server/auth/session";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact details" };

export default async function ContactStepPage({ params }: PageProps<"/dashboard/[businessId]/setup/contact">) {
  const { businessId } = await params;
  const { business } = await managedBusinessOr404(businessId);
  const user = await getCurrentUser();
  // First visit: suggest the owner's verified phone.
  const phone = business.phone ?? (business.whatsapp ? null : (user?.phone ?? null));

  return (
    <>
      <StepHeader
        businessId={business.id}
        step="contact"
        title="How can customers reach you?"
        subtitle="Shown on your page as Call and WhatsApp buttons."
      />
      <ContactForm
        businessId={business.id}
        values={{
          phone: phone ? formatPhoneInternational(phone) : "",
          whatsapp: business.whatsapp ? formatPhoneInternational(business.whatsapp) : "",
          email: business.email ?? "",
          whatsappSame: business.whatsapp === null ? business.phone === null : business.whatsapp === business.phone,
        }}
      />
    </>
  );
}
