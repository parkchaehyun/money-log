import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const createInput = z.object({
  name: z.string().trim().min(1),
  imageKey: z.string().trim().min(1).nullable().optional(),
  colorHex: z.string().trim().min(1).nullable().optional(),
  minSpendCents: z.number().int().nonnegative().nullable().optional(),
});

const updateInput = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).optional(),
  imageKey: z.string().trim().min(1).nullable().optional(),
  colorHex: z.string().trim().min(1).nullable().optional(),
  minSpendCents: z.number().int().nonnegative().nullable().optional(),
});

export const cardsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.card.findMany({
      orderBy: { name: "asc" },
      include: { paymentMethods: true },
    })
  ),
  create: protectedProcedure.input(createInput).mutation(({ ctx, input }) =>
    ctx.db.card.create({
      data: {
        name: input.name,
        imageKey: input.imageKey ?? null,
        colorHex: input.colorHex ?? null,
        minSpendCents: input.minSpendCents ?? null,
      },
      include: { paymentMethods: true },
    })
  ),
  update: protectedProcedure.input(updateInput).mutation(({ ctx, input }) => {
    const data = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.imageKey !== undefined ? { imageKey: input.imageKey } : {}),
      ...(input.colorHex !== undefined ? { colorHex: input.colorHex } : {}),
      ...(input.minSpendCents !== undefined
        ? { minSpendCents: input.minSpendCents }
        : {}),
    };

    return ctx.db.card.update({
      where: { id: input.id },
      data,
      include: { paymentMethods: true },
    });
  }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) => ctx.db.card.delete({ where: { id: input.id } })),
});
