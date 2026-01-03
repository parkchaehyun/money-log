import { Prisma } from "@prisma/client";
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
      orderBy: { name: "asc" },
    })
  ),
  create: protectedProcedure.input(createInput).mutation(({ ctx, input }) =>
    ctx.db.category.create({
      data: {
        name: input.name,
        parentId: input.parentId ?? null,
      },
    })
  ),
  update: protectedProcedure.input(updateInput).mutation(({ ctx, input }) => {
    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.parentId !== undefined) {
      data.parentId = input.parentId;
    }

    return ctx.db.category.update({
      where: { id: input.id },
      data,
    });
  }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.category.delete({ where: { id: input.id } })
    ),
});
