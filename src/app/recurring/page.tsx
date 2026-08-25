import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { RecurringScreen } from "@/components/recurring-screen";
import { RecurringSync } from "@/components/recurring-sync";
import { authOptions } from "@/server/auth";

export default async function RecurringPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/recurring");
  }

  return (
    <AppShell>
      <RecurringSync />
      <AppHeader />
      <RecurringScreen />
      <AppFooter />
    </AppShell>
  );
}
