import { PaymentMethodType, Prisma } from "@prisma/client";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

const createInput = z.object({
  name: z.string().trim().min(1),
  type: z.nativeEnum(PaymentMethodType).default(PaymentMethodType.CARD),
  cardId: z.string().cuid().nullable().optional(),
});

const updateInput = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).optional(),
  type: z.nativeEnum(PaymentMethodType).optional(),
  cardId: z.string().cuid().nullable().optional(),
});

export const paymentMethodsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.paymentMethod.findMany({
      orderBy: { name: "asc" },
      include: { card: true },
    })
  ),
  create: protectedProcedure.input(createInput).mutation(({ ctx, input }) =>
    ctx.db.paymentMethod.create({
      data: {
        name: input.name,
        type: input.type,
        cardId: input.cardId ?? null,
      },
      include: { card: true },
    })
  ),
  update: protectedProcedure.input(updateInput).mutation(({ ctx, input }) => {
    const data: Prisma.PaymentMethodUncheckedUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.type !== undefined) {
      data.type = input.type;
    }
    if (input.cardId !== undefined) {
      data.cardId = input.cardId;
    }

    return ctx.db.paymentMethod.update({
      where: { id: input.id },
      data,
      include: { card: true },
    });
  }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.paymentMethod.delete({ where: { id: input.id } })
    ),
});
