import { Prisma } from "@prisma/client";
import { z } from "zod";

import { publicProcedure, router } from "../trpc";

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
  list: publicProcedure.query(({ ctx }) =>
    ctx.db.card.findMany({
      orderBy: { name: "asc" },
      include: { paymentMethods: true },
    })
  ),
  create: publicProcedure.input(createInput).mutation(({ ctx, input }) =>
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
  update: publicProcedure.input(updateInput).mutation(({ ctx, input }) => {
    const data: Prisma.CardUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.imageKey !== undefined) {
      data.imageKey = input.imageKey;
    }
    if (input.colorHex !== undefined) {
      data.colorHex = input.colorHex;
    }
    if (input.minSpendCents !== undefined) {
      data.minSpendCents = input.minSpendCents;
    }

    return ctx.db.card.update({
      where: { id: input.id },
      data,
      include: { paymentMethods: true },
    });
  }),
  delete: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) => ctx.db.card.delete({ where: { id: input.id } })),
});
