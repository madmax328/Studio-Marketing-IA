import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeNextPath } from "@/lib/next-path";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage({ searchParams }: PageProps<"/inscription">) {
  // Déjà connecté : direction le tableau de bord.
  const next = safeNextPath((await searchParams).suite);
  const session = await getSession();
  if (session?.user.emailVerified) redirect(next ?? "/tableau-de-bord");
  return <SignUpForm next={next} />;
}
