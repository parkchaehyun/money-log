import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { QuickAddScreen } from "@/components/quick-add-screen";
import { authOptions } from "@/server/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#f3f0ea,_#f7f5f2_45%,_#fefcf9_100%)] px-6 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-8">
          <AppHeader />
          <QuickAddScreen />
          <AppFooter />
        </div>
      </div>
    </main>
  );
}
