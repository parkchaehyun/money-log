import { Prisma } from "@prisma/client";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const createInput = z.object({
  name: z.string().trim().min(1),
});

const updateInput = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).optional(),
});

export const tagsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.tag.findMany({ orderBy: { name: "asc" } })
  ),
  create: protectedProcedure.input(createInput).mutation(({ ctx, input }) =>
    ctx.db.tag.create({
      data: {
        name: input.name,
      },
    })
  ),
  update: protectedProcedure.input(updateInput).mutation(({ ctx, input }) => {
    const data: Prisma.TagUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    return ctx.db.tag.update({
      where: { id: input.id },
      data,
    });
  }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) => ctx.db.tag.delete({ where: { id: input.id } })),
});
