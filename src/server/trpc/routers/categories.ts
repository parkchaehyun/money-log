import { Prisma } from "@prisma/client";
import { z } from "zod";

import { publicProcedure, router } from "../trpc";

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
  list: publicProcedure.query(({ ctx }) =>
    ctx.db.category.findMany({
      orderBy: { name: "asc" },
    })
  ),
  create: publicProcedure.input(createInput).mutation(({ ctx, input }) =>
    ctx.db.category.create({
      data: {
        name: input.name,
        parentId: input.parentId ?? null,
      },
    })
  ),
  update: publicProcedure.input(updateInput).mutation(({ ctx, input }) => {
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
  delete: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.category.delete({ where: { id: input.id } })
    ),
});
