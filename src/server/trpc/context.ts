import { db } from "@/server/db";

export type TRPCContext = {
  db: typeof db;
};

export function createContext(_opts: {
  req: Request;
  resHeaders: Headers;
}): TRPCContext {
  return { db };
}
