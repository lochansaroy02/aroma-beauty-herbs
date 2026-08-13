"use client";

import { AlertCircleIcon, CheckIcon, HardDriveIcon, Loader2Icon, CloudIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MEDIA_DRIVERS, type MediaDriver, type MediaSettings } from "@/lib/catalog";
import { setMediaDriverAction } from "@/lib/settings-actions";
import { cn } from "@/lib/utils";

const ICONS = { local: HardDriveIcon, imagekit: CloudIcon } as const;

/**
 * Where new uploads go.
 *
 * Two cards rather than a switch: this isn't on/off, it's a choice between two
 * named things with different consequences, and a bare toggle would give the
 * admin no way to see which is which or why ImageKit is unavailable.
 */
export function MediaDriverToggle({ settings }: { settings: MediaSettings }) {
  const [driver, setDriver] = useState<MediaDriver>(settings.driver);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function select(next: MediaDriver) {
    if (next === driver || pending) return;

    setError(null);
    setSaved(false);
    // Optimistic: the server is the authority, so a rejection puts it back.
    const previous = driver;
    setDriver(next);

    startTransition(async () => {
      const result = await setMediaDriverAction(next);
      if (result.ok) setSaved(true);
      else {
        setDriver(previous);
        setError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Media storage</CardTitle>
        <CardDescription>
          Where <span className="text-foreground">new</span> uploads go. Files already
          uploaded keep the storage they were written to, so switching never moves or
          breaks anything.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {MEDIA_DRIVERS.map((option) => {
            const Icon = ICONS[option.value];
            const active = driver === option.value;
            const unavailable =
              option.value === "imagekit" && !settings.imagekit.configured;
            const stored = settings.counts[option.value] ?? 0;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => select(option.value)}
                disabled={pending || unavailable}
                aria-pressed={active}
                className={cn(
                  "grid gap-2 rounded-lg border p-4 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "hover:bg-accent/50",
                  unavailable && "cursor-not-allowed opacity-60"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">{option.label}</span>

                  {active ? (
                    <Badge className="ml-auto gap-1">
                      {pending ? (
                        <Loader2Icon className="size-3 animate-spin" />
                      ) : (
                        <CheckIcon className="size-3" />
                      )}
                      Active
                    </Badge>
                  ) : unavailable ? (
                    <Badge variant="outline" className="ml-auto">
                      Not configured
                    </Badge>
                  ) : null}
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {option.hint}
                </p>

                <p className="text-xs text-muted-foreground">
                  {stored > 0
                    ? `${stored} file${stored === 1 ? "" : "s"} stored here`
                    : "No files here yet"}
                </p>
              </button>
            );
          })}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {saved ? (
          <p className="text-sm text-muted-foreground">
            Saved — new uploads now go to{" "}
            {MEDIA_DRIVERS.find((option) => option.value === driver)?.label}.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {driver === "imagekit" && settings.imagekit.endpoint
            ? `Serving from ${settings.imagekit.endpoint}`
            : `Serving from ${settings.local.base_url}/media`}
          {settings.source === "env"
            ? " · following MEDIA_DRIVER in backend/.env until you change it here"
            : " · set here, which overrides MEDIA_DRIVER in backend/.env"}
        </p>
      </CardContent>
    </Card>
  );
}
