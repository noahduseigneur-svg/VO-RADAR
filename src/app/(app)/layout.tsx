import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { countUnseenHits, getUserState } from "@/lib/db";
import { SideNav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { ToastProvider } from "@/components/toast";
import { CompareProvider } from "@/components/compare-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [state, unseen] = await Promise.all([
    getUserState(user.id),
    countUnseenHits(user.id),
  ]);
  if (!state.onboarded_at && process.env.DEMO_MODE !== "true") redirect("/onboarding");
  return (
    <ToastProvider>
      <CompareProvider>
        <div className="flex min-h-screen">
          <SideNav dealership={user.dealership_name} unseen={unseen} />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileNav dealership={user.dealership_name} unseen={unseen} />
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
        </div>
      </CompareProvider>
    </ToastProvider>
  );
}
