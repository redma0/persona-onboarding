import OnboardingRoot from "@/components/Onboarding";
import { googleConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function Page() {
  return <OnboardingRoot googleConfigured={googleConfigured()} />;
}
