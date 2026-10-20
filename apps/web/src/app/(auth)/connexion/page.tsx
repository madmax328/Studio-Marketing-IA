import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage() {
  // Déjà connecté : direction le tableau de bord.
  const session = await getSession();
  if (session?.user.emailVerified) redirect("/tableau-de-bord");
  return <SignInForm />;
}
