import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { DashboardScreen } from "@/components/dashboard-screen";
import { authOptions } from "@/server/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f3f0ea,_#f7f5f2_45%,_#fefcf9_100%)] px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-8">
          <AppHeader />
          <DashboardScreen />
          <AppFooter />
        </div>
      </div>
    </main>
  );
}
