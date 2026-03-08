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
    search: z.string().trim().min(1).optional(),
    take: z.number().int().min(1).max(200).optional(),
  })
  .optional();

type IncomeWhere = Record<string, any>;

const buildWhere = (input?: z.infer<typeof listInput>) => {
  const where: IncomeWhere = {};
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
  if (input?.search) {
    where.description = { contains: input.search, mode: "insensitive" };
  }
  return where;
};

export const incomeRouter = router({
  list: protectedProcedure.input(listInput).query(({ ctx, input }) => {
    const where = buildWhere(input);
    return ctx.db.incomeEvent.findMany({
      where,
      orderBy: { date: "desc" },
      take: input?.take ?? 100,
      include: { card: true },
    });
  }),
  summary: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const where = buildWhere(input);
    const result = await ctx.db.incomeEvent.aggregate({
      where,
      _sum: {
        revenueCents: true,
        costCents: true,
      },
      _count: {
        _all: true,
      },
    });

    const revenueCents = result._sum.revenueCents ?? 0;
    const costCents = result._sum.costCents ?? 0;
    return {
      revenueCents,
      costCents,
      netCents: revenueCents - costCents,
      count: result._count._all,
    };
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
    const data = {
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.costCents !== undefined
        ? { costCents: input.costCents }
        : {}),
      ...(input.revenueCents !== undefined
        ? { revenueCents: input.revenueCents }
        : {}),
      ...(input.cardId !== undefined ? { cardId: input.cardId } : {}),
    };

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
  dateRange: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.incomeEvent.aggregate({
      _min: { date: true },
      _max: { date: true },
    });
    return { min: result._min.date, max: result._max.date };
  }),
});
