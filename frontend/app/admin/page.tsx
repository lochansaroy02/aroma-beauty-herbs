import {
  ExternalLinkIcon,
  FilmIcon,
  InboxIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { fetchContactMessages } from "@/lib/admin-contact";
import { fetchShopProducts } from "@/lib/shop-api";
import { fetchVideos } from "@/lib/videos";

/**
 * What this panel is for.
 *
 * The shop moved to barbersyndicate.in, so there are no orders, revenue or
 * stock numbers to report here any more. What's left is the site's own
 * furniture — the homepage, its videos, and the enquiries the contact form
 * produces — plus a read-only check that the catalogue this site depends on is
 * actually answering.
 */
export default async function AdminDashboardPage() {
  const [videos, contact, products] = await Promise.all([
    fetchVideos({ page: 1 }),
    fetchContactMessages({ page: 1 }),
    fetchShopProducts(),
  ]);

  const videoCount = videos.ok ? videos.data.pagination.total : null;
  const newEnquiries = contact.ok
    ? contact.data.messages.filter((message) => message.status === "pending").length
    : null;

  const tiles = [
    {
      href: "/admin/customisation",
      icon: LayoutTemplateIcon,
      label: "Customisation",
      value: "Homepage",
      description: "Announcement, strips, tiles and block order",
    },
    {
      href: "/admin/videos",
      icon: FilmIcon,
      label: "Videos",
      value: videoCount === null ? "—" : String(videoCount),
      description:
        videoCount === null ? "Couldn't reach the API." : "In the hero library",
    },
    {
      href: "/admin/queries",
      icon: InboxIcon,
      label: "Contact queries",
      value: newEnquiries === null ? "—" : String(newEnquiries),
      description:
        newEnquiries === null
          ? "Couldn't reach the API."
          : newEnquiries > 0
            ? "Pending a reply"
            : "Nothing pending",
    },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This site is a landing page. Products, prices and checkout live on
          Barber Syndicate — everything below is what this site owns.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="group">
            <Card className="h-full gap-0 p-5 transition-colors group-hover:border-foreground/25">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                  {tile.label}
                </span>
                <tile.icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="mt-3 font-heading text-2xl">{tile.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tile.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/*
        A health check, not a catalogue. If this says anything other than all
        four, the storefront's product pages are degraded right now and the
        cause is upstream — this panel can't fix it, but it can stop it being a
        mystery.
      */}
      <Card className="gap-0 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              Catalogue feed
            </p>
            <p className="mt-2 text-sm">
              {products.length === 4 ? (
                <span className="text-muted-foreground">
                  All 4 products are resolving from the Barber Syndicate API.
                </span>
              ) : (
                <span className="text-destructive">
                  Only {products.length} of 4 products resolved — the storefront is
                  showing an incomplete range.
                </span>
              )}
            </p>
          </div>

          <a
            href="https://barbersyndicate.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm underline underline-offset-4"
          >
            Storefront
            <ExternalLinkIcon className="size-3.5" strokeWidth={1.5} />
          </a>
        </div>

        {products.length > 0 ? (
          <ul className="mt-4 grid gap-1.5 border-t pt-4">
            {products.map((product) => (
              <li
                key={product.id}
                className="flex items-baseline justify-between gap-4 text-sm"
              >
                <span className="truncate">{product.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {product.in_stock ? "in stock" : "out of stock"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
