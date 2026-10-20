import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeNextPath } from "@/lib/next-path";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  // Déjà connecté : direction le tableau de bord.
  const next = safeNextPath((await searchParams).suite);
  const session = await getSession();
  if (session?.user.emailVerified) redirect(next ?? "/tableau-de-bord");
  return <SignInForm next={next} />;
}
