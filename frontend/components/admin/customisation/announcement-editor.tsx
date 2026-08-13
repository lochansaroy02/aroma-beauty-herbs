"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminAnnouncement } from "@/lib/catalog";
import { saveAnnouncementAction } from "@/lib/home-actions";

/** The thin bar above the header. There is only ever one, so this is a form. */
export function AnnouncementEditor({
  announcement,
}: {
  announcement: AdminAnnouncement | null;
}) {
  const [text, setText] = useState(announcement?.text ?? "");
  const [url, setUrl] = useState(announcement?.url ?? "");
  const [active, setActive] = useState(announcement?.is_active ?? true);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    text !== (announcement?.text ?? "") ||
    url !== (announcement?.url ?? "") ||
    active !== (announcement?.is_active ?? true);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveAnnouncementAction({
        text: text.trim(),
        url: url.trim() || null,
        is_active: active,
      });
      if (result.ok) setSaved(true);
      else setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Announcement bar</CardTitle>
        <CardDescription>
          The line above the header. Leave the link blank for plain text.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="announcement-text">Message</Label>
            <Input
              id="announcement-text"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setSaved(false);
              }}
              placeholder="Free delivery on orders over ₹499"
              maxLength={160}
              disabled={pending}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="announcement-url">
              Link <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="announcement-url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setSaved(false);
              }}
              placeholder="/products"
              maxLength={500}
              disabled={pending}
            />
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={active}
              onCheckedChange={(checked) => {
                setActive(checked);
                setSaved(false);
              }}
              disabled={pending}
              aria-label="Show the announcement bar"
            />
            <span className="text-sm text-muted-foreground">
              {active ? "Shown" : "Hidden"}
            </span>
          </div>

          <Button
            type="button"
            onClick={save}
            disabled={pending || !dirty || text.trim().length < 2}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Save
          </Button>

          {saved && !dirty ? (
            <span className="text-sm text-muted-foreground">Saved.</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
