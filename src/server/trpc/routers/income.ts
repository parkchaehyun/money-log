import { Prisma } from "@prisma/client";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const createInput = z.object({
  date: z.date(),
  description: z.string().trim().min(1),
  costCents: z.number().int().nonnegative().default(0),
  revenueCents: z.number().int().nonnegative().default(0),
  cardId: z.string().cuid().nullable().optional(),
});

const updateInput = z.object({
  id: z.string().cuid(),
  date: z.date().optional(),
  description: z.string().trim().min(1).optional(),
  costCents: z.number().int().nonnegative().optional(),
  revenueCents: z.number().int().nonnegative().optional(),
  cardId: z.string().cuid().nullable().optional(),
});

const listInput = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
    cardId: z.string().cuid().optional(),
    take: z.number().int().min(1).max(200).optional(),
  })
  .optional();

export const incomeRouter = router({
  list: protectedProcedure.input(listInput).query(({ ctx, input }) => {
    const where: Prisma.IncomeEventWhereInput = {};
    if (input?.from || input?.to) {
      where.date = {};
      if (input.from) {
        where.date.gte = input.from;
      }
      if (input.to) {
        where.date.lte = input.to;
      }
    }
    if (input?.cardId) {
      where.cardId = input.cardId;
    }

    return ctx.db.incomeEvent.findMany({
      where,
      orderBy: { date: "desc" },
      take: input?.take ?? 100,
      include: { card: true },
    });
  }),
  create: protectedProcedure.input(createInput).mutation(({ ctx, input }) =>
    ctx.db.incomeEvent.create({
      data: {
        date: input.date,
        description: input.description,
        costCents: input.costCents,
        revenueCents: input.revenueCents,
        cardId: input.cardId ?? null,
      },
      include: { card: true },
    })
  ),
  update: protectedProcedure.input(updateInput).mutation(({ ctx, input }) => {
    const data: Prisma.IncomeEventUncheckedUpdateInput = {};
    if (input.date) {
      data.date = input.date;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }
    if (input.costCents !== undefined) {
      data.costCents = input.costCents;
    }
    if (input.revenueCents !== undefined) {
      data.revenueCents = input.revenueCents;
    }
    if (input.cardId !== undefined) {
      data.cardId = input.cardId;
    }

    return ctx.db.incomeEvent.update({
      where: { id: input.id },
      data,
      include: { card: true },
    });
  }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.incomeEvent.delete({ where: { id: input.id } })
    ),
});
