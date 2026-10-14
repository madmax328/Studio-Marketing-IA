import { getSession } from "@/server/session";
import { exportUserData } from "@/server/services/account";

/** Export des données personnelles au format JSON (RGPD, droit à la portabilité). */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Non connecté." }, { status: 401 });
  }

  const data = await exportUserData(session.user);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="studio-marketing-ia-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
