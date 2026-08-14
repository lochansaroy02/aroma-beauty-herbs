"use client";

import {
  LayoutGridIcon,
  LogOutIcon,
  MapPinIcon,
  PackageIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ACCOUNT_NAV } from "@/lib/catalog";
import { logoutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutGridIcon,
  orders: PackageIcon,
  address: MapPinIcon,
  settings: SettingsIcon,
} as const;

/**
 * The account sidebar's links.
 *
 * A client component only because the active item depends on the current path.
 * `/account` is matched exactly — every other route starts with it, so a prefix
 * test would light up Dashboard on all four pages.
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="grid gap-1">
      {ACCOUNT_NAV.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          item.href === "/account"
            ? pathname === "/account"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-paper text-ink shadow-[0_1px_2px_rgb(14_20_15_/_0.06)]"
                : "text-ink-soft hover:bg-paper/60 hover:text-ink"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}

      <form action={logoutAction} className="contents">
        <button
          type="submit"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink-soft transition-colors hover:bg-paper/60 hover:text-ink"
        >
          <LogOutIcon className="size-4 shrink-0" aria-hidden />
          Log out
        </button>
      </form>
    </nav>
  );
}
