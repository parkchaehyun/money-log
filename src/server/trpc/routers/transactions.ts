import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { dedupeByKey } from "@/lib/dedupe";
import { protectedProcedure, router } from "../trpc";

const createInput = z
  .object({
    date: z.date(),
    merchant: z.string().trim().min(1).nullable().optional(),
    grossCents: z.number().int().nonnegative(),
    discountCents: z.number().int().min(0).default(0),
    notes: z.string().trim().min(1).nullable().optional(),
    categoryId: z.string().cuid().nullable().optional(),
    paymentMethodId: z.string().cuid().nullable().optional(),
    tagIds: z.array(z.string().cuid()).optional(),
  })
  .refine((data) => data.discountCents <= data.grossCents, {
    message: "Discount cannot exceed price.",
    path: ["discountCents"],
  });

const updateInput = z.object({
  id: z.string().cuid(),
  date: z.date().optional(),
  merchant: z.string().trim().min(1).nullable().optional(),
  grossCents: z.number().int().nonnegative().optional(),
  discountCents: z.number().int().min(0).optional(),
  notes: z.string().trim().min(1).nullable().optional(),
  categoryId: z.string().cuid().nullable().optional(),
  paymentMethodId: z.string().cuid().nullable().optional(),
  tagIds: z.array(z.string().cuid()).optional(),
});

const listInput = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
    categoryId: z.string().cuid().optional(),
    paymentMethodId: z.string().cuid().optional(),
    search: z.string().trim().min(1).optional(),
    minNetCents: z.number().int().nonnegative().optional(),
    maxNetCents: z.number().int().nonnegative().optional(),
    tagIds: z.array(z.string().cuid()).optional(),
    includeUntagged: z.boolean().optional(),
    take: z.number().int().min(1).max(200).optional(),
  })
  .optional();

type ListInput = z.infer<typeof listInput>;

type TransactionWhere = Record<string, any>;

const buildWhere = (userId: string, input?: ListInput) => {
  const where: TransactionWhere = { userId };
  const andFilters: TransactionWhere[] = [];

  if (input?.from || input?.to) {
    where.date = {};
    if (input.from) {
      where.date.gte = input.from;
    }
    if (input.to) {
      where.date.lte = input.to;
    }
  }

  if (input?.categoryId) {
    where.categoryId = input.categoryId;
  }

  if (input?.paymentMethodId) {
    where.paymentMethodId = input.paymentMethodId;
  }

  if (
    input?.minNetCents !== undefined ||
    input?.maxNetCents !== undefined
  ) {
    where.netCents = {};
    if (input?.minNetCents !== undefined) {
      where.netCents.gte = input.minNetCents;
    }
    if (input?.maxNetCents !== undefined) {
      where.netCents.lte = input.maxNetCents;
    }
  }

  if (input?.search) {
    andFilters.push({
      OR: [
        { merchant: { contains: input.search, mode: "insensitive" } },
        { notes: { contains: input.search, mode: "insensitive" } },
      ],
    });
  }

  if (input?.tagIds?.length || input?.includeUntagged) {
    const tagFilters: TransactionWhere[] = [];
    if (input.tagIds?.length) {
      tagFilters.push({
        tags: {
          some: {
            tagId: { in: input.tagIds },
          },
        },
      });
    }
    if (input.includeUntagged) {
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

export const transactionsRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const where = buildWhere(ctx.session.user.id, input);
    return ctx.db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: input?.take ?? 100,
      include: {
        category: true,
        paymentMethod: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }),
  summary: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const where = buildWhere(ctx.session.user.id, input);
    const result = await ctx.db.transaction.aggregate({
      where,
      _sum: {
        grossCents: true,
        discountCents: true,
        netCents: true,
      },
      _count: {
        _all: true,
      },
    });

    return {
      grossCents: result._sum.grossCents ?? 0,
      discountCents: result._sum.discountCents ?? 0,
      netCents: result._sum.netCents ?? 0,
      count: result._count._all,
    };
  }),
  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await assertOwnedRefs(ctx.db, userId, {
        categoryId: input.categoryId ?? null,
        paymentMethodId: input.paymentMethodId ?? null,
        tagIds: input.tagIds,
      });

      const netCents = input.grossCents - input.discountCents;
      const tagIds = input.tagIds ?? [];

      return ctx.db.transaction.create({
        data: {
          userId,
          date: input.date,
          merchant: input.merchant ?? null,
          grossCents: input.grossCents,
          discountCents: input.discountCents,
          netCents,
          notes: input.notes ?? null,
          categoryId: input.categoryId ?? null,
          paymentMethodId: input.paymentMethodId ?? null,
          tags: tagIds.length
            ? {
                create: tagIds.map((tagId) => ({
                  tag: { connect: { id: tagId } },
                })),
              }
            : undefined,
        },
        include: {
          category: true,
          paymentMethod: true,
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });
  }),
  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await ctx.db.transaction.findFirst({
        where: { id: input.id, userId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      await assertOwnedRefs(ctx.db, userId, {
        categoryId: input.categoryId,
        paymentMethodId: input.paymentMethodId,
        tagIds: input.tagIds,
      });

      const grossCents = input.grossCents ?? existing.grossCents;
      const discountCents = input.discountCents ?? existing.discountCents;

      if (discountCents > grossCents) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Discount cannot exceed price.",
        });
      }

      const data = {
        netCents: grossCents - discountCents,
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
        ...(input.grossCents !== undefined
          ? { grossCents: input.grossCents }
          : {}),
        ...(input.discountCents !== undefined
          ? { discountCents: input.discountCents }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.paymentMethodId !== undefined
          ? { paymentMethodId: input.paymentMethodId }
          : {}),
        ...(input.tagIds !== undefined
          ? {
              tags: {
                deleteMany: {},
                create: input.tagIds.map((tagId) => ({
                  tag: { connect: { id: tagId } },
                })),
              },
            }
          : {}),
      };

      return ctx.db.transaction.update({
        where: { id: input.id, userId },
        data,
        include: {
          category: true,
          paymentMethod: true,
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });
  }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      })
    ),
  dateRange: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.transaction.aggregate({
      where: { userId: ctx.session.user.id },
      _min: { date: true },
      _max: { date: true },
    });
    return { min: result._min.date, max: result._max.date };
  }),
  // Distinct merchants (most recent first) with the fields from their latest
  // entry, for Quick Add autocomplete. The client filters this list with
  // jamo-aware matching, so we return the full distinct set rather than
  // searching server-side. Scan is capped to the recent window.
  merchantOptions: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.transaction.findMany({
      where: { userId: ctx.session.user.id, merchant: { not: null } },
      orderBy: { date: "desc" },
      take: 3000,
      select: {
        merchant: true,
        grossCents: true,
        discountCents: true,
        categoryId: true,
        paymentMethodId: true,
        tags: { select: { tagId: true } },
      },
    });

    return dedupeByKey(rows, (row) => row.merchant ?? "", 1000).map((row) => ({
      merchant: row.merchant as string,
      grossCents: row.grossCents,
      discountCents: row.discountCents,
      categoryId: row.categoryId,
      paymentMethodId: row.paymentMethodId,
      tagIds: row.tags.map((t) => t.tagId),
    }));
  }),
});

async function assertOwnedRefs(
  db: typeof import("@/server/db").db,
  userId: string,
  refs: {
    categoryId?: string | null;
    paymentMethodId?: string | null;
    tagIds?: string[];
  }
) {
  if (refs.categoryId) {
    const found = await db.category.findFirst({
      where: { id: refs.categoryId, userId },
      select: { id: true },
    });
    if (!found) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
    }
  }

  if (refs.paymentMethodId) {
    const found = await db.paymentMethod.findFirst({
      where: { id: refs.paymentMethodId, userId },
      select: { id: true },
    });
    if (!found) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payment method not found",
      });
    }
  }

  if (refs.tagIds?.length) {
    const count = await db.tag.count({
      where: { id: { in: refs.tagIds }, userId },
    });
    if (count !== new Set(refs.tagIds).size) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Tag not found" });
    }
  }
}
