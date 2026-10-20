"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reviewTestimonialAction } from "@/server/actions/testimonials";

export function ReviewButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const decide = (decision: "approved" | "rejected") =>
    start(async () => {
      const result = await reviewTestimonialAction(id, decision);
      if (!result.ok) window.alert(result.error);
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      <Button disabled={pending || status === "approved"} onClick={() => decide("approved")}>
        Valider
      </Button>
      <Button variant="secondary" disabled={pending || status === "rejected"} onClick={() => decide("rejected")}>
        Refuser
      </Button>
    </div>
  );
}
