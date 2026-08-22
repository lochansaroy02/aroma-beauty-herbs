"use client";

import { CheckIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { refreshCatalogueAction } from "@/lib/shop-actions";

/**
 * Pulls the latest product names, prices and links from barbersyndicate.in.
 *
 * Sits next to the feed status because that is where someone looks after
 * editing a product over there and not seeing it here.
 */
export function RefreshCatalogueButton() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    startTransition(async () => {
      await refreshCatalogueAction();
      setDone(true);
      // Confirmation, not a permanent state.
      setTimeout(() => setDone(false), 2500);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2Icon className="animate-spin" />
      ) : done ? (
        <CheckIcon />
      ) : (
        <RefreshCwIcon />
      )}
      {done ? "Updated" : "Refresh"}
    </Button>
  );
}
