"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import type { SubscriptionStatus } from "@/lib/types";

export function SubscriptionToggle({ uid, status }: { uid: string; status: SubscriptionStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const updateUser = httpsCallable(functions, "updateUser");
      await updateUser({ uid, subscriptionStatus: status === "active" ? "inactive" : "active" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={status === "active" ? "outline" : "success"}
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? "…" : status === "active" ? "Deactivate" : "Activate"}
    </Button>
  );
}
