import { cardsRouter } from "./routers/cards";
import { categoriesRouter } from "./routers/categories";
import { incomeRouter } from "./routers/income";
import { paymentMethodsRouter } from "./routers/payment-methods";
import { tagsRouter } from "./routers/tags";
import { transactionsRouter } from "./routers/transactions";
import { router } from "./trpc";

export const appRouter = router({
  transactions: transactionsRouter,
  income: incomeRouter,
  categories: categoriesRouter,
  cards: cardsRouter,
  paymentMethods: paymentMethodsRouter,
  tags: tagsRouter,
});

export type AppRouter = typeof appRouter;
