"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PremiumIntroSequence } from "../../../components/premium/PremiumIntroSequence";
import { PREMIUM_ROUTES } from "../../../lib/premiumMode";

export default function PremiumPlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showId = searchParams.get("show");

  return (
    <PremiumIntroSequence
      onComplete={() => {
        const href = showId
          ? `${PREMIUM_ROUTES.picks}?show=${showId}`
          : PREMIUM_ROUTES.picks;
        router.push(href);
      }}
    />
  );
}
