"use client";

import { AlertTriangleIcon, HistoryIcon, Loader2Icon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { InventoryItem, StockMovement } from "@/lib/catalog";
import {
  adjustStockAction,
  loadStockHistoryAction,
  setLowStockAlertAction,
  type AdjustMode,
} from "@/lib/inventory-actions";
import { cn } from "@/lib/utils";

const MODES: { value: AdjustMode; label: string; hint: string }[] = [
  { value: "add", label: "Add", hint: "A delivery arrived" },
  { value: "remove", label: "Remove", hint: "Damage, loss or a sample" },
  { value: "set", label: "Set", hint: "A physical stock count" },
];

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function MovementRow({ entry }: { entry: StockMovement }) {
  const delta = entry.stock_after - entry.stock_before;

  return (
    <li className="grid gap-0.5 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Badge variant={entry.type === "OUT" ? "destructive" : "secondary"}>
            {entry.type}
          </Badge>
          <span className="tabular-nums">
            {entry.stock_before} → {entry.stock_after}
          </span>
        </span>
        <span
          className={cn(
            "text-xs tabular-nums",
            delta > 0 ? "text-primary" : delta < 0 ? "text-destructive" : ""
          )}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      </div>

      <span className="text-xs text-muted-foreground">
        {entry.notes ?? entry.reference_type ?? "—"}
        {entry.by ? ` · ${entry.by}` : ""}
        {entry.at ? ` · ${DATE_FORMAT.format(new Date(entry.at))}` : ""}
      </span>
    </li>
  );
}

export function AdjustStockDialog({ item }: { item: InventoryItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [mode, setMode] = useState<AdjustMode>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [threshold, setThreshold] = useState(String(item.low_stock_alert));

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<StockMovement[] | null>(null);

  function reset() {
    setMode("add");
    setQuantity("");
    setReason("");
    setThreshold(String(item.low_stock_alert));
    setError(null);
    setNotice(null);
    setHistory(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  const parsedQuantity = Number(quantity);
  const validQuantity = quantity !== "" && Number.isInteger(parsedQuantity) && parsedQuantity >= 0;

  // What the count will read after this change — shown before committing.
  const projected = !validQuantity
    ? item.stock_qty
    : mode === "set"
      ? parsedQuantity
      : mode === "add"
        ? item.stock_qty + parsedQuantity
        : item.stock_qty - parsedQuantity;

  function applyAdjustment() {
    if (!validQuantity) {
      setError("Enter a whole number.");
      return;
    }

    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await adjustStockAction(item.variant_id, {
        mode,
        quantity: parsedQuantity,
        reason: reason.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setQuantity("");
      setReason("");
      setNotice(result.warning ?? `Stock is now ${result.item.stock_qty}.`);
      setHistory(null);
      router.refresh();
    });
  }

  function applyThreshold() {
    const value = Number(threshold);

    if (threshold === "" || !Number.isInteger(value) || value < 0) {
      setError("The alert level must be a whole number.");
      return;
    }

    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await setLowStockAlertAction(item.variant_id, value);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNotice(
        value === 0
          ? "Low-stock alert turned off."
          : `You'll be warned at ${value} or fewer available.`
      );
      router.refresh();
    });
  }

  function toggleHistory() {
    if (history) {
      setHistory(null);
      return;
    }

    startTransition(async () => {
      const result = await loadStockHistoryAction(item.variant_id);
      if (result.ok) setHistory(result.history);
      else setError(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <SettingsIcon />
        Manage
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {item.product.product_name}
          </DialogTitle>
          <DialogDescription>
            {item.variation_name && item.variation_name !== "Default"
              ? `${item.variation_name} · `
              : ""}
            {item.sku}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {notice ? (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}

          {item.oversold ? (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertDescription>
                {item.reserved_qty} reserved for unpaid orders, but only{" "}
                {item.stock_qty} in stock.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "In stock", value: item.stock_qty },
              { label: "Reserved", value: item.reserved_qty },
              { label: "Available", value: item.available_qty },
            ].map((tile) => (
              <div key={tile.label} className="rounded-md border p-3">
                <p className="font-heading text-2xl tabular-nums">{tile.value}</p>
                <p className="text-xs text-muted-foreground">{tile.label}</p>
              </div>
            ))}
          </div>

          <Separator />

          <div className="grid gap-3">
            <span className="text-sm font-medium">Adjust stock</span>

            <div
              role="group"
              aria-label="Adjustment type"
              className="flex gap-1 rounded-md bg-muted p-1"
            >
              {MODES.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={mode === option.value ? "default" : "ghost"}
                  aria-pressed={mode === option.value}
                  onClick={() => setMode(option.value)}
                  className="flex-1"
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {MODES.find((option) => option.value === mode)?.hint}
            </p>

            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={pending}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reason">
                  Reason <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Delivery, breakage, recount…"
                  maxLength={300}
                  disabled={pending}
                />
              </div>
            </div>

            {validQuantity && parsedQuantity > 0 ? (
              <p
                className={cn(
                  "text-sm",
                  projected < 0 ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {projected < 0
                  ? `Can't remove ${parsedQuantity} — only ${item.stock_qty} in stock.`
                  : `Stock will go from ${item.stock_qty} to ${projected}.`}
              </p>
            ) : null}

            <Button
              type="button"
              onClick={applyAdjustment}
              disabled={pending || !validQuantity || projected < 0}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Apply
            </Button>
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label htmlFor="threshold">Low stock alert</Label>
            <div className="flex gap-2">
              <Input
                id="threshold"
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                disabled={pending}
                className="w-28"
              />
              <Button
                type="button"
                variant="outline"
                onClick={applyThreshold}
                disabled={pending}
              >
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Flags this variant when available stock drops to this number. Zero
              turns the alert off.
            </p>
          </div>

          <Separator />

          <div className="grid gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleHistory}
              disabled={pending}
              className="justify-start"
            >
              <HistoryIcon />
              {history ? "Hide stock history" : "Show stock history"}
            </Button>

            {history ? (
              history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No movements recorded yet.
                </p>
              ) : (
                <ul className="max-h-64 divide-y overflow-y-auto rounded-md border px-3">
                  {history.map((entry) => (
                    <MovementRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Done
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
