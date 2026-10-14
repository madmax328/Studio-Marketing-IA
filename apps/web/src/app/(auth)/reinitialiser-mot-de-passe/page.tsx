import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reinitialiser-mot-de-passe">) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : null} />;
}
