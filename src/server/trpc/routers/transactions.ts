import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { publicProcedure, router } from "../trpc";

const createInput = z
  .object({
    date: z.date(),
    merchant: z.string().trim().min(1).nullable().optional(),
    grossCents: z.number().int().nonnegative(),
    discountCents: z.number().int().min(0).default(0),
    notes: z.string().trim().min(1).nullable().optional(),
    categoryId: z.string().cuid().nullable().optional(),
    paymentMethodId: z.string().cuid().nullable().optional(),
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
});

const listInput = z
  .object({
    from: z.date().optional(),
    to: z.date().optional(),
    categoryId: z.string().cuid().optional(),
    paymentMethodId: z.string().cuid().optional(),
    take: z.number().int().min(1).max(200).optional(),
  })
  .optional();

export const transactionsRouter = router({
  list: publicProcedure.input(listInput).query(async ({ ctx, input }) => {
    const where: Prisma.TransactionWhereInput = {};
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

    return ctx.db.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: input?.take ?? 100,
      include: {
        category: true,
        paymentMethod: true,
      },
    });
  }),
  create: publicProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const netCents = input.grossCents - input.discountCents;

    return ctx.db.transaction.create({
      data: {
        date: input.date,
        merchant: input.merchant ?? null,
        grossCents: input.grossCents,
        discountCents: input.discountCents,
        netCents,
        notes: input.notes ?? null,
        categoryId: input.categoryId ?? null,
        paymentMethodId: input.paymentMethodId ?? null,
      },
      include: {
        category: true,
        paymentMethod: true,
      },
    });
  }),
  update: publicProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.transaction.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Transaction not found" });
    }

    const grossCents = input.grossCents ?? existing.grossCents;
    const discountCents = input.discountCents ?? existing.discountCents;

    if (discountCents > grossCents) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Discount cannot exceed price.",
      });
    }

    const data: Prisma.TransactionUncheckedUpdateInput = {
      netCents: grossCents - discountCents,
    };

    if (input.date) {
      data.date = input.date;
    }
    if (input.merchant !== undefined) {
      data.merchant = input.merchant;
    }
    if (input.grossCents !== undefined) {
      data.grossCents = input.grossCents;
    }
    if (input.discountCents !== undefined) {
      data.discountCents = input.discountCents;
    }
    if (input.notes !== undefined) {
      data.notes = input.notes;
    }
    if (input.categoryId !== undefined) {
      data.categoryId = input.categoryId;
    }
    if (input.paymentMethodId !== undefined) {
      data.paymentMethodId = input.paymentMethodId;
    }

    return ctx.db.transaction.update({
      where: { id: input.id },
      data,
      include: {
        category: true,
        paymentMethod: true,
      },
    });
  }),
  delete: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction.delete({ where: { id: input.id } })
    ),
});
