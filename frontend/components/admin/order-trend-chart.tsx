"use client";

import { Loader2Icon, TableIcon, TrendingUpIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatPrice,
  STAT_GRAINS,
  type OrderStats,
  type StatGrain,
  type StatPoint,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Orders and revenue over time.
 *
 * Two charts, not one with two y-axes. They're different units on wildly
 * different scales (single-digit counts against thousands of rupees), and
 * overlaying them would invent a correlation by choosing where the scales line
 * up. Small multiples sharing one x-axis and one range control say the same
 * thing without the lie.
 */

/** Slot 1 blue and the brand's leaf green — validated for CVD separation
 *  (ΔE 19.8 deutan) and ≥3:1 against the white card. */
const ORDERS_COLOR = "#2a78d6";
const REVENUE_COLOR = "#007A55";

const PLOT_HEIGHT = 132;
/** Room under the plot for the x-axis band, so labels are never clipped. */
const AXIS_BAND = 22;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 10;

export function OrderTrendChart({ stats }: { stats: OrderStats }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showTable, setShowTable] = useState(false);

  const active = STAT_GRAINS.find((grain) => grain.value === stats.grain) ?? STAT_GRAINS[0];

  function selectGrain(grain: StatGrain) {
    const next = new URLSearchParams(searchParams);
    if (grain === "day") next.delete("range");
    else next.set("range", grain);

    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  return (
    <div className="grid gap-4">
      {/* One filter row above everything it scopes — not a control per card. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUpIcon className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-lg tracking-tight">Trend</h2>
          <span className="text-sm text-muted-foreground">{active.caption}</span>
          {pending ? <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" /> : null}
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Time range"
            className="inline-flex rounded-lg border p-0.5"
          >
            {STAT_GRAINS.map((grain) => (
              <button
                key={grain.value}
                type="button"
                onClick={() => selectGrain(grain.value)}
                aria-pressed={grain.value === stats.grain}
                className={cn(
                  "rounded-md px-3 py-1 text-xs transition-colors",
                  grain.value === stats.grain
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {grain.label}
              </button>
            ))}
          </div>

          {/* The table view is the WCAG-clean twin: every value readable
              without relying on hover or on colour. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTable((shown) => !shown)}
            aria-pressed={showTable}
          >
            <TableIcon />
            {showTable ? "Hide table" : "Table"}
          </Button>
        </div>
      </div>

      {/* Held at reduced opacity while refetching — no skeleton flash, no jump. */}
      <div className={cn("grid gap-4 transition-opacity lg:grid-cols-2", pending && "opacity-60")}>
        <TrendCard
          title="Orders"
          total={String(stats.totals.orders)}
          points={stats.points}
          grain={stats.grain}
          pick={(point) => point.orders}
          format={(value) => String(value)}
          color={ORDERS_COLOR}
          integral
        />
        <TrendCard
          title="Paid revenue"
          total={formatPrice(stats.totals.revenue)}
          points={stats.points}
          grain={stats.grain}
          pick={(point) => point.revenue}
          format={formatPrice}
          color={REVENUE_COLOR}
        />
      </div>

      {showTable ? <StatTable stats={stats} /> : null}
    </div>
  );
}

/* ── One plot ───────────────────────────────────────────────────────────── */

type CardProps = {
  title: string;
  total: string;
  points: StatPoint[];
  grain: StatGrain;
  pick: (point: StatPoint) => number;
  format: (value: number) => string;
  color: string;
  /** Counts must not produce fractional axis ticks. */
  integral?: boolean;
};

function TrendCard({ title, total, points, grain, pick, format, color, integral }: CardProps) {
  const gradientId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Measured rather than scaled by viewBox: a viewBox stretched to fit would
  // shrink the axis text along with the plot, and these sit two-up on wide
  // screens and full width on narrow ones.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const values = points.map(pick);
  const max = niceMax(Math.max(...values, 0), integral);
  const innerWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);

  const x = (index: number) =>
    PAD_LEFT + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) => PAD_TOP + (1 - value / max) * (PLOT_HEIGHT - PAD_TOP);

  const line = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area =
    values.length > 0
      ? `M ${x(0)},${PLOT_HEIGHT} L ${line.split(" ").join(" L ")} L ${x(values.length - 1)},${PLOT_HEIGHT} Z`
      : "";

  const ticks = [0, max / 2, max];
  const lastIndex = values.length - 1;
  const activeIndex = hover ?? lastIndex;
  const activePoint = points[activeIndex];

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {/* Proportional figures, not tabular — this is a standalone value. */}
        <p className="font-heading text-2xl">{total}</p>
      </CardHeader>

      <CardContent className="px-4">
        <div ref={containerRef} className="relative w-full">
          {width > 0 ? (
            <svg
              width={width}
              height={PLOT_HEIGHT + AXIS_BAND}
              role="img"
              aria-label={`${title} by ${grain}. Total ${total}.`}
              className="block overflow-visible"
              onMouseLeave={() => setHover(null)}
              onMouseMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const offset = event.clientX - bounds.left - PAD_LEFT;
                const ratio = innerWidth > 0 ? offset / innerWidth : 0;
                const index = Math.round(ratio * (points.length - 1));
                setHover(Math.min(points.length - 1, Math.max(0, index)));
              }}
            >
              <defs>
                {/* A wash, not a saturated block. */}
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              {/* Hairline, solid, recessive — never dashed. */}
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD_LEFT}
                    x2={width - PAD_RIGHT}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="currentColor"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    className="text-border"
                  />
                  <text
                    x={PAD_LEFT - 8}
                    y={y(tick) + 3}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {compact(tick)}
                  </text>
                </g>
              ))}

              <path d={area} fill={`url(#${gradientId})`} />
              <polyline
                points={line}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Crosshair on hover; the end point stays marked when idle. */}
              {hover !== null ? (
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD_TOP}
                  y2={PLOT_HEIGHT}
                  stroke="currentColor"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  className="text-muted-foreground/40"
                />
              ) : null}

              {activePoint ? (
                <circle
                  cx={x(activeIndex)}
                  cy={y(pick(activePoint))}
                  r={4}
                  fill={color}
                  // 2px surface ring, so the marker stays legible over the line.
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ) : null}

              {points.map((point, index) =>
                showTick(index, points.length) ? (
                  <text
                    key={point.bucket}
                    x={x(index)}
                    y={PLOT_HEIGHT + 15}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {shortLabel(point.bucket, grain)}
                  </text>
                ) : null
              )}
            </svg>
          ) : (
            <div style={{ height: PLOT_HEIGHT + AXIS_BAND }} />
          )}

          {hover !== null && activePoint && width > 0 ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"
              style={{
                left: Math.min(Math.max(x(hover), 60), width - 60),
                top: 0,
              }}
            >
              <p className="text-muted-foreground">{fullLabel(activePoint.bucket, grain)}</p>
              <p className="font-medium tabular-nums">{format(pick(activePoint))}</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Table view ─────────────────────────────────────────────────────────── */

function StatTable({ stats }: { stats: OrderStats }) {
  // Newest period first. Copied, not reversed in place — `points` is the same
  // array the two charts plot, and those must stay chronological left to right.
  const rows = [...stats.points].reverse();

  return (
    <Card className="py-0">
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Orders and paid revenue per {stats.grain}, most recent first
          </caption>
          <thead className="sticky top-0 bg-muted/50 text-left">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">Period</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Orders</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Paid revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((point) => (
              <tr key={point.bucket} className="border-t">
                <td className="px-4 py-2">{fullLabel(point.bucket, stats.grain)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{point.orders}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPrice(point.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

/**
 * Rounds the axis top to a clean number so ticks read 0 / 250 / 500.
 *
 * `integral` is for counts: orders come in whole numbers, and a midpoint tick
 * reading "2.5 orders" is nonsense, so the top is forced even and the midpoint
 * lands on an integer.
 */
function niceMax(value: number, integral = false): number {
  if (value <= 0) return integral ? 2 : 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  let top = 10 * magnitude;

  for (const step of steps) {
    const candidate = step * magnitude;
    if (value <= candidate) {
      top = candidate;
      break;
    }
  }

  if (!integral) return top;
  const rounded = Math.ceil(top);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}K`;
  return trim(value);
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

/** Thin the x labels so they never collide at 30 buckets. */
function showTick(index: number, total: number): boolean {
  if (total <= 6) return true;
  const every = Math.ceil(total / 6);
  return index % every === 0 || index === total - 1;
}

const SHORT_DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const SHORT_MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });
const FULL_DAY = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const FULL_MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function shortLabel(bucket: string, grain: StatGrain): string {
  const date = new Date(bucket);
  return grain === "month" ? SHORT_MONTH.format(date) : SHORT_DAY.format(date);
}

function fullLabel(bucket: string, grain: StatGrain): string {
  const date = new Date(bucket);
  if (grain === "month") return FULL_MONTH.format(date);
  if (grain === "week") return `Week of ${FULL_DAY.format(date)}`;
  return FULL_DAY.format(date);
}
