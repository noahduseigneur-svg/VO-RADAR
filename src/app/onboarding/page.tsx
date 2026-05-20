import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getUserState, getBrands } from "@/lib/db";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const user = await requireUser();
  const state = await getUserState(user.id);

  // Déjà onboardé → rediriger vers les annonces
  if (state.onboarded_at) redirect("/listings");

  const brands = await getBrands();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <OnboardingWizard
        userId={user.id}
        dealershipName={user.dealership_name}
        brands={brands}
      />
    </div>
  );
}
