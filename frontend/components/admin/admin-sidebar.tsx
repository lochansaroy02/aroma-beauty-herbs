"use client";

import {
  ArrowUpRightIcon,
  BoxesIcon,
  FilmIcon,
  InboxIcon,
  LayoutTemplateIcon,
  LayoutDashboardIcon,
  LeafIcon,
  PackageIcon,
  ShoppingCartIcon,
  StoreIcon,
  TicketPercentIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/products", label: "All products", icon: PackageIcon },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon },
  { href: "/admin/inventory", label: "Inventory management", icon: BoxesIcon },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercentIcon },
  { href: "/admin/queries", label: "Contact queries", icon: InboxIcon },
  { href: "/admin/videos", label: "Videos", icon: FilmIcon },
  { href: "/admin/customisation", label: "Customisation", icon: LayoutTemplateIcon },
] as const;

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  /** /admin matches only itself; the rest match their subpaths too. */
  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* SidebarMenuButton composes via useRender, so no nativeButton flag. */}
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LeafIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-heading">Aroma</span>
                <span className="truncate text-xs text-muted-foreground">Admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Out of the "Manage" group on purpose: it leaves the admin rather
                than navigating within it, and opens in a new tab so whatever
                was being edited here stays put. */}
            <SidebarMenuButton
              tooltip="View store"
              render={<Link href="/" target="_blank" rel="noopener noreferrer" />}
            >
              <StoreIcon />
              <span>View store</span>
              {/* size-3.5! beats the button's own [&_svg]:size-4 — the hint
                  should sit under the leading icon, not match it. */}
              <ArrowUpRightIcon className="ml-auto size-3.5! opacity-60 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            {/* Signed-in address; hidden automatically when collapsed to icons. */}
            <div className="truncate px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {email}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}