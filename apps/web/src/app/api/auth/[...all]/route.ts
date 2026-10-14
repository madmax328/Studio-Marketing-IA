import { getAuth } from "@/server/auth";
import { ensureDatabaseReady } from "@/server/db/client";

async function handler(request: Request): Promise<Response> {
  await ensureDatabaseReady();
  return getAuth().handler(request);
}

export { handler as GET, handler as POST };
