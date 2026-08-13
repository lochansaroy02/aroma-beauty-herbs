"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SECTION_META, type HomeSection } from "@/lib/catalog";
import { updateSectionsAction } from "@/lib/home-actions";
import { cn } from "@/lib/utils";

/**
 * Order, visibility and layout for the homepage's blocks.
 *
 * Move buttons rather than drag-and-drop: six fixed rows don't justify a drag
 * library, and arrows are the version that works from the keyboard and on a
 * phone without any extra work.
 */
export function SectionArranger({ sections }: { sections: HomeSection[] }) {
  const [rows, setRows] = useState(sections);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compared against what was last written, not against the prop: the server
  // component's props don't change until a refresh lands, so using them here
  // would leave the form looking permanently unsaved after a successful save.
  const [baseline, setBaseline] = useState(sections);
  const dirty = JSON.stringify(rows) !== JSON.stringify(baseline);

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;

    const next = [...rows];
    const [row] = next.splice(index, 1);
    if (row) next.splice(target, 0, row);
    setRows(next);
    setSaved(false);
  }

  function patch(key: string, changes: Partial<HomeSection>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row))
    );
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateSectionsAction(rows);
      if (result.ok) {
        setBaseline(rows);
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Homepage layout</CardTitle>
        <CardDescription>
          The order blocks appear in, whether each one shows, and how it renders.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3">
        <ul className="grid gap-2">
          {rows.map((row, index) => {
            const meta = SECTION_META[row.key];

            return (
              <li
                key={row.key}
                className={cn(
                  "grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center",
                  !row.is_visible && "bg-muted/40"
                )}
              >
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || pending}
                    aria-label={`Move ${meta.label} up`}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1 || pending}
                    aria-label={`Move ${meta.label} down`}
                  >
                    <ArrowDownIcon />
                  </Button>
                </div>

                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", !row.is_visible && "text-muted-foreground")}>
                    {meta.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{meta.hint}</p>

                  {meta.layouts.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {meta.layouts.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => patch(row.key, { layout: option.value })}
                          aria-pressed={row.layout === option.value}
                          title={option.hint}
                          disabled={pending}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs transition-colors",
                            row.layout === option.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 justify-self-start sm:justify-self-end">
                  <span className="text-xs text-muted-foreground">
                    {row.is_visible ? "Shown" : "Hidden"}
                  </span>
                  <Switch
                    checked={row.is_visible}
                    onCheckedChange={(checked) => patch(row.key, { is_visible: checked })}
                    disabled={pending}
                    aria-label={`Show ${meta.label}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={!dirty || pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Save layout
          </Button>
          {saved && !dirty ? (
            <span className="text-sm text-muted-foreground">Saved.</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
