"use client";

import { useActionState } from "react";
import { startConnectOnboardingAction } from "@/app/actions/payments";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

export function ConnectOnboardingForm({ storeId, label }: { storeId: string; label: string }) {
  const [state, action] = useActionState(startConnectOnboardingAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="storeId" value={storeId} />
      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      <SubmitButton size="lg" pendingLabel="Stripe へ移動しています…">
        {label}
      </SubmitButton>
    </form>
  );
}
