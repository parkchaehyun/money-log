import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { dedupeByKey } from "@/lib/dedupe";
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

const buildWhere = (userId: string, input?: z.infer<typeof listInput>) => {
  const where: Prisma.IncomeEventWhereInput = { userId };
  if (input?.from || input?.to) {
    const date: Prisma.DateTimeFilter = {};
    if (input.from) {
      date.gte = input.from;
    }
    if (input.to) {
      date.lte = input.to;
    }
    where.date = date;
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
    const where = buildWhere(ctx.session.user.id, input);
    return ctx.db.incomeEvent.findMany({
      where,
      orderBy: { date: "desc" },
      take: input?.take ?? 100,
      include: { card: true },
    });
  }),
  summary: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const where = buildWhere(ctx.session.user.id, input);
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
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (input.cardId) {
        await assertOwnedCard(ctx.db, input.cardId, userId);
      }
      return ctx.db.incomeEvent.create({
        data: {
          userId,
          date: input.date,
          description: input.description,
          costCents: input.costCents,
          revenueCents: input.revenueCents,
          cardId: input.cardId ?? null,
        },
        include: { card: true },
      });
    }),
  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      if (input.cardId) {
        await assertOwnedCard(ctx.db, input.cardId, userId);
      }
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
        where: { id: input.id, userId },
        data,
        include: { card: true },
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.incomeEvent.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      })
    ),
  dateRange: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.incomeEvent.aggregate({
      where: { userId: ctx.session.user.id },
      _min: { date: true },
      _max: { date: true },
    });
    return { min: result._min.date, max: result._max.date };
  }),
  // Distinct income descriptions (most recent first) with the fields from
  // their latest entry, for Income autocomplete. The client filters this list
  // with jamo-aware matching.
  sourceOptions: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.incomeEvent.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { date: "desc" },
      take: 3000,
      select: {
        description: true,
        revenueCents: true,
        costCents: true,
        cardId: true,
      },
    });

    return dedupeByKey(rows, (row) => row.description, 1000);
  }),
});

async function assertOwnedCard(
  db: typeof import("@/server/db").db,
  id: string,
  userId: string
) {
  const found = await db.card.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!found) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
  }
}
