"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { STRIP_TONES, type AdminStrip } from "@/lib/catalog";
import {
  createStripAction,
  deleteStripAction,
  reorderStripsAction,
  updateStripAction,
} from "@/lib/home-actions";
import { cn } from "@/lib/utils";

/**
 * The scrolling bands.
 *
 * Text edits save on blur rather than behind a Save button — there is one field
 * per strip and an admin fixing a typo shouldn't have to hunt for a control.
 * Toggles and tone save immediately, since they have no intermediate state.
 */
export function StripEditor({ strips }: { strips: AdminStrip[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  function run(id: number | null, action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "That didn't save.");
      setBusyId(null);
    });
  }

  function add() {
    const text = draft.trim();
    if (text.length < 2) return;

    run(null, async () => {
      const result = await createStripAction({
        text,
        direction: strips.length % 2 === 0 ? "left" : "right",
        // Alternate the tone so two strips never read as a repeat.
        tone: strips.length % 2 === 0 ? "ink" : "leaf",
        speed: null,
        is_active: true,
      });
      if (result.ok) setDraft("");
      return result;
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= strips.length) return;

    const next = strips.map((strip) => strip.id);
    const [id] = next.splice(index, 1);
    if (id !== undefined) next.splice(target, 0, id);
    run(null, () => reorderStripsAction(next));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Marquee strips</CardTitle>
        <CardDescription>
          The scrolling bands between sections. The first two are used, in this order.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <ul className="grid gap-3">
          {strips.map((strip, index) => (
            <li key={strip.id} className="grid gap-3 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || pending}
                    aria-label={`Move strip ${index + 1} up`}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => move(index, 1)}
                    disabled={index === strips.length - 1 || pending}
                    aria-label={`Move strip ${index + 1} down`}
                  >
                    <ArrowDownIcon />
                  </Button>
                </div>

                <div className="grid flex-1 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`strip-${strip.id}`} className="sr-only">
                      Strip text
                    </Label>
                    <Input
                      id={`strip-${strip.id}`}
                      defaultValue={strip.text}
                      maxLength={160}
                      disabled={pending}
                      onBlur={(event) => {
                        const text = event.target.value.trim();
                        if (text.length >= 2 && text !== strip.text) {
                          run(strip.id, () => updateStripAction(strip.id, { text }));
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Separate phrases with · — it reads as tape on a jar.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Tone</span>
                      {STRIP_TONES.map((tone) => (
                        <button
                          key={tone}
                          type="button"
                          onClick={() => run(strip.id, () => updateStripAction(strip.id, { tone }))}
                          aria-pressed={strip.tone === tone}
                          disabled={pending}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs capitalize transition-colors",
                            strip.tone === tone
                              ? "border-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "size-3 rounded-full",
                              tone === "ink" ? "bg-[#0E140F]" : "bg-[#007A55]"
                            )}
                            aria-hidden
                          />
                          {tone}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Direction</span>
                      {(["left", "right"] as const).map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          onClick={() =>
                            run(strip.id, () => updateStripAction(strip.id, { direction }))
                          }
                          aria-pressed={strip.direction === direction}
                          disabled={pending}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs capitalize transition-colors",
                            strip.direction === direction
                              ? "border-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {direction}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={strip.is_active}
                        disabled={pending}
                        onCheckedChange={(checked) =>
                          run(strip.id, () => updateStripAction(strip.id, { is_active: checked }))
                        }
                        aria-label="Show this strip"
                      />
                      <span className="text-xs text-muted-foreground">
                        {strip.is_active ? "Shown" : "Hidden"}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive"
                      disabled={pending}
                      onClick={() => run(strip.id, () => deleteStripAction(strip.id))}
                      aria-label={`Delete strip ${index + 1}`}
                    >
                      {busyId === strip.id && pending ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <Trash2Icon />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {strips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No strips yet — the bands won&rsquo;t render until you add one.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Small batch · Cold pressed · No fillers"
            maxLength={160}
            disabled={pending}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" onClick={add} disabled={draft.trim().length < 2 || pending}>
            {pending && busyId === null ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
