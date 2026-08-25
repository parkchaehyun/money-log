import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { DashboardScreen } from "@/components/dashboard-screen";
import { RecurringSync } from "@/components/recurring-sync";
import { authOptions } from "@/server/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return (
    <AppShell>
      <RecurringSync />
      <AppHeader />
      <DashboardScreen />
      <AppFooter />
    </AppShell>
  );
}
