-- CreateEnum
CREATE TYPE "RecurringKind" AS ENUM ('SPEND', 'INCOME');

-- CreateEnum
CREATE TYPE "RecurringCadence" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "IncomeEvent" ADD COLUMN     "recurringRuleId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "recurringRuleId" TEXT;

-- CreateTable
CREATE TABLE "RecurringRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "RecurringKind" NOT NULL,
    "cadence" "RecurringCadence" NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "autoConfirm" BOOLEAN NOT NULL DEFAULT false,
    "lastGeneratedDate" TIMESTAMP(3),
    "merchant" TEXT,
    "grossCents" INTEGER,
    "discountCents" INTEGER,
    "categoryId" TEXT,
    "paymentMethodId" TEXT,
    "tagIds" TEXT[],
    "description" TEXT,
    "revenueCents" INTEGER,
    "costCents" INTEGER,
    "cardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOccurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringRule_userId_idx" ON "RecurringRule"("userId");

-- CreateIndex
CREATE INDEX "RecurringRule_categoryId_idx" ON "RecurringRule"("categoryId");

-- CreateIndex
CREATE INDEX "RecurringRule_paymentMethodId_idx" ON "RecurringRule"("paymentMethodId");

-- CreateIndex
CREATE INDEX "RecurringRule_cardId_idx" ON "RecurringRule"("cardId");

-- CreateIndex
CREATE INDEX "RecurringOccurrence_userId_idx" ON "RecurringOccurrence"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOccurrence_ruleId_dueDate_key" ON "RecurringOccurrence"("ruleId", "dueDate");

-- CreateIndex
CREATE INDEX "IncomeEvent_recurringRuleId_idx" ON "IncomeEvent"("recurringRuleId");

-- CreateIndex
CREATE INDEX "Transaction_recurringRuleId_idx" ON "Transaction"("recurringRuleId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEvent" ADD CONSTRAINT "IncomeEvent_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOccurrence" ADD CONSTRAINT "RecurringOccurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOccurrence" ADD CONSTRAINT "RecurringOccurrence_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RecurringRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
