"use server";

import { redirect } from "next/navigation";
import { formatPhoneInternational } from "@/lib/phone";
import { safeReturnPath } from "@/lib/safe-return-path";
import {
  requestPhoneOtp,
  signInWithEmailPassword,
  signOut,
  signUpWithEmailPassword,
  verifyPhoneOtp,
} from "@/server/auth/sign-in";

export type PhoneFormState = {
  step: "phone" | "code";
  phone?: string;
  /** Pre-formatted on the server so the client bundle doesn't need libphonenumber. */
  phoneDisplay?: string;
  message?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
};

export async function phoneSignInAction(prev: PhoneFormState, formData: FormData): Promise<PhoneFormState> {
  const intent = formData.get("intent");
  const next = safeReturnPath(formData.get("next")?.toString());

  if (intent === "change-number") return { step: "phone" };

  if (intent === "send" || intent === "resend") {
    const rawPhone = intent === "resend" ? (prev.phone ?? "") : (formData.get("phone")?.toString() ?? "");
    const result = await requestPhoneOtp(rawPhone);
    if (!result.ok) {
      return {
        step: intent === "resend" ? "code" : "phone",
        phone: prev.phone,
        message: result.message,
        fieldErrors: result.fieldErrors,
      };
    }
    return {
      step: "code",
      phone: result.value.phone,
      phoneDisplay: formatPhoneInternational(result.value.phone),
      notice: intent === "resend" ? "We sent a new code." : undefined,
    };
  }

  if (intent === "verify") {
    const phone = formData.get("phone")?.toString() ?? "";
    const result = await verifyPhoneOtp(phone, formData.get("code")?.toString() ?? "");
    if (!result.ok) {
      return {
        step: "code",
        phone,
        phoneDisplay: prev.phoneDisplay,
        message: result.message,
        fieldErrors: result.fieldErrors,
      };
    }
    redirect(next);
  }

  return { step: prev.step, phone: prev.phone, message: "Something went wrong. Please try again." };
}

export type EmailFormState = {
  message?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
};

export async function emailSignInAction(_prev: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const intent = formData.get("intent");
  const input = {
    email: formData.get("email")?.toString() ?? "",
    password: formData.get("password")?.toString() ?? "",
  };

  if (intent === "sign-up") {
    const result = await signUpWithEmailPassword(input);
    if (!result.ok) return { message: result.message, fieldErrors: result.fieldErrors };
    return { notice: "Check your email for a link to confirm your account." };
  }

  const result = await signInWithEmailPassword(input);
  if (!result.ok) return { message: result.message, fieldErrors: result.fieldErrors };
  redirect(safeReturnPath(formData.get("next")?.toString()));
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/");
}
