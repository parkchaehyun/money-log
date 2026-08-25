import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/server/auth";
import { db } from "@/server/db";

export type TRPCContext = {
  db: typeof db;
  session: Session | null;
};

export async function createContext(opts: {
  req: Request;
  resHeaders: Headers;
}): Promise<TRPCContext> {
  void opts;
  const session = await getServerSession(authOptions);
  return { db, session: session ?? null };
}
