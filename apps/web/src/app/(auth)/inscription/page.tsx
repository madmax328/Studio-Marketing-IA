import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage() {
  // Déjà connecté : direction le tableau de bord.
  const session = await getSession();
  if (session?.user.emailVerified) redirect("/tableau-de-bord");
  return <SignUpForm />;
}
