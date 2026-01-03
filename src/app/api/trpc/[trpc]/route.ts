import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { createContext } from "@/server/trpc/context";
import { appRouter } from "@/server/trpc/root";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path, type }) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error("tRPC failed", { path, type, error });
      }
    },
  });

export { handler as GET, handler as POST };
