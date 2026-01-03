import { Prisma } from "@prisma/client";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const spendFilterInput = z
  .object({
    categoryIds: z.array(z.string().cuid()).optional(),
    paymentMethodIds: z.array(z.string().cuid()).optional(),
    tagIds: z.array(z.string().cuid()).optional(),
    includeNoTags: z.boolean().optional(),
  })
  .optional();

const yearInput = z.object({
  year: z.number().int().min(2000).max(2100),
  filters: spendFilterInput,
});

const monthInput = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  filters: spendFilterInput,
});

const buildYearRange = (year: number) => ({
  start: new Date(year, 0, 1, 0, 0, 0, 0),
  end: new Date(year, 11, 31, 23, 59, 59, 999),
});

const buildMonthRange = (year: number, month: number) => ({
  start: new Date(year, month - 1, 1, 0, 0, 0, 0),
  end: new Date(year, month, 0, 23, 59, 59, 999),
});

type SpendFilters = z.infer<typeof spendFilterInput>;

const buildSpendWhere = (
  filters: SpendFilters,
  start: Date,
  end: Date
): Prisma.TransactionWhereInput => {
  const where: Prisma.TransactionWhereInput = {
    date: {
      gte: start,
      lte: end,
    },
  };
  const andFilters: Prisma.TransactionWhereInput[] = [];

  if (filters?.categoryIds?.length) {
    where.categoryId = { in: filters.categoryIds };
  }
  if (filters?.paymentMethodIds?.length) {
    where.paymentMethodId = { in: filters.paymentMethodIds };
  }

  if (filters?.tagIds?.length || filters?.includeNoTags) {
    const tagFilters: Prisma.TransactionWhereInput[] = [];
    if (filters?.tagIds?.length) {
      tagFilters.push({
        tags: {
          some: {
            tagId: { in: filters.tagIds },
          },
        },
      });
    }
    if (filters?.includeNoTags) {
      tagFilters.push({
        tags: {
          none: {},
        },
      });
    }
    if (tagFilters.length === 1) {
      andFilters.push(tagFilters[0]);
    } else if (tagFilters.length > 1) {
      andFilters.push({ OR: tagFilters });
    }
  }

  if (andFilters.length) {
    where.AND = andFilters;
  }

  return where;
};

export const dashboardRouter = router({
  years: protectedProcedure.query(async ({ ctx }) => {
    const nowYear = new Date().getFullYear();
    const [earliestTx, latestTx, earliestIncome, latestIncome] =
      await Promise.all([
        ctx.db.transaction.findFirst({
          select: { date: true },
          orderBy: { date: "asc" },
        }),
        ctx.db.transaction.findFirst({
          select: { date: true },
          orderBy: { date: "desc" },
        }),
        ctx.db.incomeEvent.findFirst({
          select: { date: true },
          orderBy: { date: "asc" },
        }),
        ctx.db.incomeEvent.findFirst({
          select: { date: true },
          orderBy: { date: "desc" },
        }),
      ]);

    const minYear = Math.min(
      earliestTx?.date.getFullYear() ?? nowYear,
      earliestIncome?.date.getFullYear() ?? nowYear,
      nowYear
    );
    const maxYear = Math.max(
      latestTx?.date.getFullYear() ?? nowYear,
      latestIncome?.date.getFullYear() ?? nowYear,
      nowYear
    );

    const years: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
      years.push(year);
    }
    return years.length ? years : [nowYear];
  }),

  yearOverview: protectedProcedure
    .input(yearInput)
    .query(async ({ ctx, input }) => {
      const { start, end } = buildYearRange(input.year);
      const spendWhere = buildSpendWhere(input.filters, start, end);
      const [spendEntries, incomeEntries] = await Promise.all([
        ctx.db.transaction.findMany({
          where: spendWhere,
          select: { date: true, netCents: true },
        }),
        ctx.db.incomeEvent.findMany({
          where: { date: { gte: start, lte: end } },
          select: { date: true, revenueCents: true, costCents: true },
        }),
      ]);

      const spendByMonth = Array.from({ length: 12 }, () => 0);
      const incomeByMonth = Array.from({ length: 12 }, () => 0);

      spendEntries.forEach((entry) => {
        const monthIndex = entry.date.getMonth();
        spendByMonth[monthIndex] += entry.netCents;
      });

      incomeEntries.forEach((entry) => {
        const monthIndex = entry.date.getMonth();
        incomeByMonth[monthIndex] += entry.revenueCents - entry.costCents;
      });

      const months = spendByMonth.map((spendNet, index) => {
        const incomeNet = incomeByMonth[index] ?? 0;
        return {
          month: index + 1,
          spendNetCents: spendNet,
          incomeNetCents: incomeNet,
          effectiveNetCents: spendNet - incomeNet,
        };
      });

      const totals = {
        spendNetCents: spendByMonth.reduce((sum, value) => sum + value, 0),
        incomeNetCents: incomeByMonth.reduce((sum, value) => sum + value, 0),
        effectiveNetCents: spendByMonth.reduce((sum, value) => sum + value, 0) -
          incomeByMonth.reduce((sum, value) => sum + value, 0),
      };

      return { months, totals };
    }),

  monthCategory: protectedProcedure
    .input(monthInput)
    .query(async ({ ctx, input }) => {
      const { start, end } = buildMonthRange(input.year, input.month);
      const spendWhere = buildSpendWhere(input.filters, start, end);
      const entries = await ctx.db.transaction.findMany({
        where: spendWhere,
        select: {
          netCents: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      });

      const categoryMap = new Map<
        string,
        { id: string; name: string; netCents: number }
      >();

      entries.forEach((entry) => {
        const id = entry.categoryId ?? "uncategorized";
        const name = entry.category?.name ?? "Uncategorized";
        const existing = categoryMap.get(id);
        if (existing) {
          existing.netCents += entry.netCents;
        } else {
          categoryMap.set(id, { id, name, netCents: entry.netCents });
        }
      });

      return Array.from(categoryMap.values()).sort(
        (a, b) => b.netCents - a.netCents
      );
    }),

  monthCards: protectedProcedure
    .input(
      monthInput.extend({ limit: z.number().int().min(1).max(12).optional() })
    )
    .query(async ({ ctx, input }) => {
      const { start, end } = buildMonthRange(input.year, input.month);
      const spendWhere = buildSpendWhere(input.filters, start, end);
      const entries = await ctx.db.transaction.findMany({
        where: {
          ...spendWhere,
          paymentMethod: { type: "CARD" },
        },
        select: {
          grossCents: true,
          discountCents: true,
          paymentMethod: {
            select: {
              card: { select: { id: true, name: true } },
            },
          },
        },
      });

      const cardMap = new Map<
        string,
        { id: string; name: string; grossCents: number; discountCents: number }
      >();

      entries.forEach((entry) => {
        const card = entry.paymentMethod?.card;
        if (!card) {
          return;
        }
        const existing = cardMap.get(card.id);
        if (existing) {
          existing.grossCents += entry.grossCents;
          existing.discountCents += entry.discountCents;
        } else {
          cardMap.set(card.id, {
            id: card.id,
            name: card.name,
            grossCents: entry.grossCents,
            discountCents: entry.discountCents,
          });
        }
      });

      const limit = input.limit ?? 6;
      const sorted = Array.from(cardMap.values()).sort(
        (a, b) => b.grossCents - a.grossCents
      );

      if (sorted.length <= limit) {
        return sorted;
      }

      const top = sorted.slice(0, limit);
      const rest = sorted.slice(limit);
      const other = rest.reduce(
        (acc, item) => {
          acc.grossCents += item.grossCents;
          acc.discountCents += item.discountCents;
          return acc;
        },
        { id: "other", name: "Other", grossCents: 0, discountCents: 0 }
      );

      return other.grossCents > 0 ? [...top, other] : top;
    }),
});
