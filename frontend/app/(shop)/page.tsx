import { FeaturedRow } from "@/components/shop/featured-row";
import { HeroFallback, HeroVideo } from "@/components/shop/hero-video";
import { MarqueeStrip } from "@/components/shop/marquee-strip";
import { TileGrid } from "@/components/shop/tile-grid";
import { fetchHome } from "@/lib/home";
import type { SectionKey } from "@/lib/catalog";

export const metadata = {
  title: "Aroma Beauty Herbs — herbal skincare, blended in small batches",
  description:
    "Treatments and elixirs blended in small batches from plants we can name. Made in India.",
};

export default async function HomePage() {
  const home = await fetchHome();

  // Order, visibility and per-block layout all come from Admin → Customisation.
  // The announcement bar is rendered by the shop layout's header, so it has a
  // row here for ordering purposes but nothing to draw.
  const [firstStrip, secondStrip] = home.strips;

  function render(key: SectionKey, layout: string | null) {
    switch (key) {
      case "hero":
        return home.hero ? (
          <HeroVideo hero={home.hero} layout={layout ?? "full"} />
        ) : (
          <HeroFallback />
        );
      case "strip_a":
        return firstStrip ? <MarqueeStrip strip={firstStrip} /> : null;
      case "featured":
        return <FeaturedRow products={home.featured} layout={layout ?? "row"} />;
      case "strip_b":
        return secondStrip ? <MarqueeStrip strip={secondStrip} /> : null;
      case "tiles":
        return <TileGrid tiles={home.tiles} layout={layout ?? "three"} />;
      case "announcement":
        return null;
      default:
        return null;
    }
  }

  return (
    <>
      {home.sections
        .filter((section) => section.is_visible)
        .map((section) => (
          <div key={section.key}>{render(section.key, section.layout)}</div>
        ))}
    </>
  );
}
