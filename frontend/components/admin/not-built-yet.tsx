import { ConstructionIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Honest placeholder for a nav destination whose API doesn't exist yet — better
 * than a 404 from the sidebar, and it says what's actually missing.
 */
export function NotBuiltYet({
  title,
  description,
  needs,
}: {
  title: string;
  description: string;
  needs: string[];
}) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ConstructionIcon className="size-8 text-muted-foreground" />
          <p className="font-heading text-lg">Not built yet</p>
          <div className="text-sm text-muted-foreground">
            <p>This screen needs:</p>
            <ul className="mt-2 space-y-1">
              {needs.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}