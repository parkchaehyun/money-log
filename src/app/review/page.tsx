import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { ReviewScreen } from "@/components/review-screen";
import { RecurringSync } from "@/components/recurring-sync";
import { authOptions } from "@/server/auth";

export default async function ReviewPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/review");
  }

  return (
    <AppShell>
      <RecurringSync />
      <AppHeader />
      <ReviewScreen />
      <AppFooter />
    </AppShell>
  );
}
