import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { QuickAddScreen } from "@/components/quick-add-screen";
import { RecurringDue } from "@/components/recurring-due";
import { RecurringSync } from "@/components/recurring-sync";
import { authOptions } from "@/server/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/");
  }

  return (
    <AppShell>
      <RecurringSync />
      <AppHeader />
      <RecurringDue />
      <QuickAddScreen />
      <AppFooter />
    </AppShell>
  );
}
