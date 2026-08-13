import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = ["Your details", "Verify email", "Start shopping"];

/**
 * Numbered because creating an account genuinely is a fixed sequence — the
 * numbers tell you how much is left, they aren't decoration.
 */
export function StepRail({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const isCurrent = step === current;
        const isDone = step < current;

        return (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "block h-0.5 w-full rounded-full",
                isDone || isCurrent ? "bg-primary" : "bg-border"
              )}
            />
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs",
                isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isDone ? (
                <CheckIcon className="size-3 shrink-0 text-primary" />
              ) : (
                <span className="tabular-nums">{step}</span>
              )}
              <span className="hidden truncate sm:inline">{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}