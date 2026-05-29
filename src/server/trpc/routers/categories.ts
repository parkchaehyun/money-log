import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const createInput = z.object({
  name: z.string().trim().min(1),
  parentId: z.string().cuid().nullable().optional(),
});

const updateInput = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).optional(),
  parentId: z.string().cuid().nullable().optional(),
});

export const categoriesRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.category.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { name: "asc" },
    })
  ),
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (input.parentId) {
        await assertOwnedCategory(ctx.db, input.parentId, userId);
      }
      return ctx.db.category.create({
        data: {
          userId,
          name: input.name,
          parentId: input.parentId ?? null,
        },
      });
    }),
  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (input.parentId) {
        await assertOwnedCategory(ctx.db, input.parentId, userId);
      }
      const data = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      };

      return ctx.db.category.update({
        where: { id: input.id, userId },
        data,
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.category.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      })
    ),
});

async function assertOwnedCategory(
  db: typeof import("@/server/db").db,
  id: string,
  userId: string
) {
  const found = await db.category.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!found) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
  }
}
