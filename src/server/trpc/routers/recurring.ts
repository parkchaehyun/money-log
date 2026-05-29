import type { Prisma, RecurringRule } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { computeDueDates, nextDueDate } from "@/server/recurring";
import { protectedProcedure, router } from "../trpc";

type Db = typeof import("@/server/db").db;

const ruleObject = z.object({
  kind: z.enum(["SPEND", "INCOME"]),
  cadence: z.enum(["WEEKLY", "MONTHLY"]),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startDate: z.date(),
  endDate: z.date().nullable().optional(),
  autoConfirm: z.boolean().optional(),
  // Spend payload
  merchant: z.string().trim().min(1).nullable().optional(),
  grossCents: z.number().int().nonnegative().nullable().optional(),
  discountCents: z.number().int().min(0).nullable().optional(),
  categoryId: z.string().cuid().nullable().optional(),
  paymentMethodId: z.string().cuid().nullable().optional(),
  tagIds: z.array(z.string().cuid()).optional(),
  // Income payload
  description: z.string().trim().min(1).nullable().optional(),
  revenueCents: z.number().int().nonnegative().nullable().optional(),
  costCents: z.number().int().nonnegative().nullable().optional(),
  cardId: z.string().cuid().nullable().optional(),
});

type RuleInput = z.infer<typeof ruleObject>;

const checkRule = (val: RuleInput, ctx: z.RefinementCtx) => {
  const isAuto = val.autoConfirm ?? false;
  if (val.cadence === "MONTHLY" && val.dayOfMonth == null) {
    ctx.addIssue({
      code: "custom",
      message: "Pick a day of the month.",
      path: ["dayOfMonth"],
    });
  }
  if (val.cadence === "WEEKLY" && val.dayOfWeek == null) {
    ctx.addIssue({
      code: "custom",
      message: "Pick a day of the week.",
      path: ["dayOfWeek"],
    });
  }
  if (val.endDate && val.endDate < val.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    });
  }
  if (val.kind === "SPEND") {
    const grossCents = val.grossCents ?? null;
    const discountCents = val.discountCents ?? null;
    if (grossCents == null) {
      if (isAuto) {
        ctx.addIssue({
          code: "custom",
          message: "Enter an amount for automatic rules.",
          path: ["grossCents"],
        });
      }
      if ((discountCents ?? 0) > 0) {
        ctx.addIssue({
          code: "custom",
          message: "Enter an amount before adding a discount.",
          path: ["grossCents"],
        });
      }
    } else if (grossCents <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Amount must be greater than zero.",
        path: ["grossCents"],
      });
    }
    if (grossCents != null && (discountCents ?? 0) > grossCents) {
      ctx.addIssue({
        code: "custom",
        message: "Discount cannot exceed the amount.",
        path: ["discountCents"],
      });
    }
  } else {
    if (!val.description) {
      ctx.addIssue({
        code: "custom",
        message: "Add a description.",
        path: ["description"],
      });
    }
    const revenueCents = val.revenueCents ?? null;
    const costCents = val.costCents ?? null;
    if (revenueCents != null && revenueCents <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Revenue must be blank or greater than zero.",
        path: ["revenueCents"],
      });
    }
    if (costCents != null && costCents <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Cost must be blank or greater than zero.",
        path: ["costCents"],
      });
    }
    if (isAuto && (revenueCents ?? 0) <= 0 && (costCents ?? 0) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter revenue or cost for automatic rules.",
        path: ["revenueCents"],
      });
    }
  }
};

const createInput = ruleObject.superRefine(checkRule);
const updateInput = ruleObject
  .extend({ id: z.string().cuid() })
  .superRefine(checkRule);

// Validate that referenced rows belong to the user, and that the rule's tagIds
// only keep tags the user still owns.
async function resolveRefs(
  db: Db,
  userId: string,
  input: {
    categoryId?: string | null;
    paymentMethodId?: string | null;
    cardId?: string | null;
    tagIds?: string[];
  }
) {
  if (input.categoryId) {
    const found = await db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { id: true },
    });
    if (!found) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
    }
  }
  if (input.paymentMethodId) {
    const found = await db.paymentMethod.findFirst({
      where: { id: input.paymentMethodId, userId },
      select: { id: true },
    });
    if (!found) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payment method not found",
      });
    }
  }
  if (input.cardId) {
    const found = await db.card.findFirst({
      where: { id: input.cardId, userId },
      select: { id: true },
    });
    if (!found) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
    }
  }
  let tagIds: string[] = [];
  if (input.tagIds?.length) {
    const owned = await db.tag.findMany({
      where: { id: { in: input.tagIds }, userId },
      select: { id: true },
    });
    tagIds = owned.map((t) => t.id);
  }
  return tagIds;
}

// Build the persisted column values from validated input, nulling out the
// fields that don't apply to the rule's kind.
function buildRuleData(input: RuleInput, tagIds: string[]) {
  const isSpend = input.kind === "SPEND";
  return {
    kind: input.kind,
    cadence: input.cadence,
    dayOfMonth: input.cadence === "MONTHLY" ? input.dayOfMonth ?? null : null,
    dayOfWeek: input.cadence === "WEEKLY" ? input.dayOfWeek ?? null : null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    autoConfirm: input.autoConfirm ?? false,
    merchant: isSpend ? input.merchant ?? null : null,
    grossCents: isSpend ? input.grossCents ?? null : null,
    discountCents: isSpend ? input.discountCents ?? null : null,
    categoryId: isSpend ? input.categoryId ?? null : null,
    paymentMethodId: isSpend ? input.paymentMethodId ?? null : null,
    tagIds: isSpend ? tagIds : [],
    description: isSpend ? null : input.description ?? null,
    revenueCents: isSpend ? null : input.revenueCents ?? null,
    costCents: isSpend ? null : input.costCents ?? null,
    cardId: isSpend ? null : input.cardId ?? null,
  };
}

type MaterializeOverrides = {
  date?: Date;
  merchant?: string | null;
  grossCents?: number;
  discountCents?: number;
  categoryId?: string | null;
  paymentMethodId?: string | null;
  description?: string;
  revenueCents?: number;
  costCents?: number;
  cardId?: string | null;
};

const pick = <T>(override: T | undefined, fallback: T): T =>
  override !== undefined ? override : fallback;

// Create a real Transaction / IncomeEvent from a rule for a given due date.
// Overrides (from the Due-card "Edit" flow) take precedence over rule values.
async function materialize(
  db: Prisma.TransactionClient,
  userId: string,
  rule: RecurringRule,
  dueDate: Date,
  overrides: MaterializeOverrides = {}
) {
  const date = overrides.date ?? dueDate;
  if (rule.kind === "SPEND") {
    const grossCents = pick(overrides.grossCents, rule.grossCents ?? 0);
    if (grossCents <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Enter an amount to add this recurring item.",
      });
    }
    const discountCents = Math.min(
      pick(overrides.discountCents, rule.discountCents ?? 0),
      grossCents
    );
    const ownedTags = rule.tagIds.length
      ? await db.tag.findMany({
          where: { id: { in: rule.tagIds }, userId },
          select: { id: true },
        })
      : [];
    return db.transaction.create({
      data: {
        userId,
        date,
        merchant: pick(overrides.merchant, rule.merchant),
        grossCents,
        discountCents,
        netCents: grossCents - discountCents,
        categoryId: pick(overrides.categoryId, rule.categoryId),
        paymentMethodId: pick(overrides.paymentMethodId, rule.paymentMethodId),
        recurringRuleId: rule.id,
        tags: ownedTags.length
          ? {
              create: ownedTags.map((t) => ({
                tag: { connect: { id: t.id } },
              })),
            }
          : undefined,
      },
    });
  }

  const revenueCents = pick(overrides.revenueCents, rule.revenueCents ?? 0);
  const costCents = pick(overrides.costCents, rule.costCents ?? 0);
  if (revenueCents <= 0 && costCents <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enter revenue or cost to add this recurring item.",
    });
  }
  return db.incomeEvent.create({
    data: {
      userId,
      date,
      description: pick(overrides.description, rule.description ?? "Recurring income"),
      revenueCents,
      costCents,
      cardId: pick(overrides.cardId, rule.cardId),
      recurringRuleId: rule.id,
    },
  });
}

export const recurringRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rules = await ctx.db.recurringRule.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      include: { category: true, paymentMethod: true, card: true },
    });
    const today = new Date();
    return rules.map((rule) => ({
      ...rule,
      nextDueDate: rule.active ? nextDueDate(rule, today) : null,
    }));
  }),

  create: protectedProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const tagIds = await resolveRefs(ctx.db, userId, input);
      // lastGeneratedDate stays null so the first sync backfills every
      // occurrence from the start date up to today.
      return ctx.db.recurringRule.create({
        data: {
          userId,
          ...buildRuleData(input, tagIds),
          lastGeneratedDate: null,
        },
      });
    }),

  update: protectedProcedure
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await ctx.db.recurringRule.findFirst({
        where: { id: input.id, userId },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });
      }
      const tagIds = await resolveRefs(ctx.db, userId, input);
      return ctx.db.recurringRule.update({
        where: { id: input.id, userId },
        data: buildRuleData(input, tagIds),
      });
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.string().cuid(), active: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.recurringRule.update({
        where: { id: input.id, userId: ctx.session.user.id },
        data: { active: input.active },
      })
    ),

  remove: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.recurringRule.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      })
    ),

  // Lazy generation: called once when the app loads. Materializes auto-confirm
  // occurrences directly and queues confirm-mode ones as pending.
  sync: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const today = new Date();
    const rules = await ctx.db.recurringRule.findMany({
      where: { userId, active: true },
    });

    let queued = 0;
    const createdEntries: {
      kind: "SPEND" | "INCOME";
      label: string;
      netCents: number;
    }[] = [];
    for (const rule of rules) {
      const dueDates = computeDueDates(rule, today);
      if (!dueDates.length) {
        continue;
      }
      // Generate a rule's occurrences and advance lastGeneratedDate atomically,
      // so a partial failure can't leave entries that get re-created (and thus
      // duplicated) on the next sync.
      await ctx.db.$transaction(async (tx) => {
        for (const dueDate of dueDates) {
          if (rule.autoConfirm) {
            await materialize(tx, userId, rule, dueDate);
          } else {
            await tx.recurringOccurrence.upsert({
              where: { ruleId_dueDate: { ruleId: rule.id, dueDate } },
              create: { userId, ruleId: rule.id, dueDate },
              update: {},
            });
          }
        }
        await tx.recurringRule.update({
          where: { id: rule.id },
          data: { lastGeneratedDate: dueDates[dueDates.length - 1] },
        });
      });

      // Summarize only after the transaction commits.
      if (rule.autoConfirm) {
        const netCents =
          rule.kind === "SPEND"
            ? (rule.grossCents ?? 0) - (rule.discountCents ?? 0)
            : (rule.revenueCents ?? 0) - (rule.costCents ?? 0);
        const label =
          rule.kind === "SPEND"
            ? rule.merchant || "Recurring purchase"
            : rule.description || "Recurring income";
        for (let i = 0; i < dueDates.length; i += 1) {
          createdEntries.push({ kind: rule.kind, label, netCents });
        }
      } else {
        queued += dueDates.length;
      }
    }
    return { created: createdEntries.length, queued, createdEntries };
  }),

  pendingOccurrences: protectedProcedure.query(({ ctx }) =>
    ctx.db.recurringOccurrence.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { dueDate: "asc" },
      include: {
        rule: {
          include: { category: true, paymentMethod: true, card: true },
        },
      },
    })
  ),

  confirmOccurrence: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        date: z.date().optional(),
        merchant: z.string().trim().min(1).nullable().optional(),
        grossCents: z.number().int().nonnegative().optional(),
        discountCents: z.number().int().min(0).optional(),
        categoryId: z.string().cuid().nullable().optional(),
        paymentMethodId: z.string().cuid().nullable().optional(),
        description: z.string().trim().min(1).optional(),
        revenueCents: z.number().int().nonnegative().optional(),
        costCents: z.number().int().nonnegative().optional(),
        cardId: z.string().cuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const occurrence = await ctx.db.recurringOccurrence.findFirst({
        where: { id: input.id, userId },
        include: { rule: true },
      });
      if (!occurrence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Occurrence not found",
        });
      }
      // Validate any overridden references belong to the user.
      await resolveRefs(ctx.db, userId, {
        categoryId: input.categoryId,
        paymentMethodId: input.paymentMethodId,
        cardId: input.cardId,
      });

      await materialize(ctx.db, userId, occurrence.rule, occurrence.dueDate, {
        date: input.date,
        merchant: input.merchant,
        grossCents: input.grossCents,
        discountCents: input.discountCents,
        categoryId: input.categoryId,
        paymentMethodId: input.paymentMethodId,
        description: input.description,
        revenueCents: input.revenueCents,
        costCents: input.costCents,
        cardId: input.cardId,
      });
      await ctx.db.recurringOccurrence.delete({ where: { id: occurrence.id } });
      return { ok: true };
    }),

  skipOccurrence: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.recurringOccurrence.delete({
        where: { id: input.id, userId: ctx.session.user.id },
      })
    ),
});
