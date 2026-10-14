import type { Metadata } from "next";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const metadata: Metadata = { title: "Confirmer votre e-mail" };

export default function VerifyEmailPage() {
  return <ResendVerificationForm />;
}
