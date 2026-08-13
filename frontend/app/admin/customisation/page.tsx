import { AlertCircleIcon, ExternalLinkIcon, FilmIcon } from "lucide-react";
import Link from "next/link";

import { AnnouncementEditor } from "@/components/admin/customisation/announcement-editor";
import { SectionArranger } from "@/components/admin/customisation/section-arranger";
import { StripEditor } from "@/components/admin/customisation/strip-editor";
import { TileEditor } from "@/components/admin/customisation/tile-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAdminHome } from "@/lib/admin-home";

export const metadata = { title: "Customisation — Aroma Admin" };

export default async function CustomisationPage() {
  const result = await fetchAdminHome();

  if (!result.ok) {
    return (
      <div className="grid gap-6">
        <Header />
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const home = result.data;

  return (
    <div className="grid gap-6">
      <Header />

      <SectionArranger sections={home.sections} />
      <AnnouncementEditor announcement={home.announcement} />
      <StripEditor strips={home.strips} />
      <TileEditor tiles={home.tiles} />

      {/*
        The hero video is edited under Videos, which owns uploads of that size.
        Pointing at it beats duplicating the upload flow in two places and
        leaving two ways to get the same row into a different state.
      */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Hero video</CardTitle>
          <CardDescription>
            {home.hero.configured
              ? `${home.hero.count} active video section${home.hero.count === 1 ? "" : "s"}. The first one is the hero.`
              : "No hero video yet — the homepage falls back to a still panel."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/videos" />}>
            <FilmIcon />
            Manage videos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-2xl tracking-tight">Customisation</h1>
        <p className="text-sm text-muted-foreground">
          What the homepage shows, in what order, and how each block renders.
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href="/" target="_blank" rel="noopener noreferrer" />}
      >
        <ExternalLinkIcon />
        Preview
      </Button>
    </div>
  );
}
