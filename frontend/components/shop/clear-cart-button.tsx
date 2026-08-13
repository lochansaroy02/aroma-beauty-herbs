"use client";

import { Loader2Icon } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { clearCartAction } from "@/lib/cart-actions";

export function ClearCartButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(async () => void (await clearCartAction()))}
      className="text-muted-foreground"
    >
      {pending ? <Loader2Icon className="animate-spin" /> : null}
      Clear cart
    </Button>
  );
}
