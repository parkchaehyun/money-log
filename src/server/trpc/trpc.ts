import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError, type ZodFlattenedError } from "zod";

import type { TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const zodError =
      error.cause instanceof ZodError
        ? (error.cause.flatten() as ZodFlattenedError<
            Record<string, unknown>
          >)
        : null;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next();
});
