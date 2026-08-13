/**
 * Fills the homepage's configurable slots with sensible starting content.
 *
 *   npm run seed:home
 *
 * Idempotent — re-running updates the rows it created rather than piling up
 * duplicates. Everything it writes is editable afterwards; this only exists so
 * a fresh database renders a complete page instead of a skeleton.
 *
 * It does not touch products: the featured row is driven by each product's own
 * "Featured" toggle and Order by, both already in the product form.
 */
import { prisma } from "./lib/prisma";
//change 
const STRIPS = [
  { text: "100% Vegan · Herbal Actives", direction: "left", order_by: 1 },
  { text: "Rooted in Ayurveda · Made in India", direction: "right", order_by: 2 },
];

const TILES = [
  {
    name: "Ingredients",
    slug: "What goes in, and what never does",
    url: "/ingredients",
  },
  { name: "Shop", slug: "The full range", url: "/products" },
  { name: "Our story", slug: "Why we started", url: "/our-story" },
];

async function main() {
  const announcement = await prisma.topBarText.findFirst({
    where: { deleted_at: null },
    orderBy: { id: "asc" },
  });

  if (announcement) {
    await prisma.topBarText.update({
      where: { id: announcement.id },
      data: { name: "Free delivery on orders over ₹499", status: 1 },
    });
    console.log("Updated the announcement bar.");
  } else {
    await prisma.topBarText.create({
      data: { name: "Free delivery on orders over ₹499", status: 1, is_featured: 1 },
    });
    console.log("Created the announcement bar.");
  }

  for (const strip of STRIPS) {
    const existing = await prisma.homeStrip.findFirst({
      where: { order_by: strip.order_by, deleted_at: null },
    });

    if (existing) {
      await prisma.homeStrip.update({ where: { id: existing.id }, data: strip });
    } else {
      await prisma.homeStrip.create({ data: { ...strip, status: 1 } });
    }
  }
  console.log(`Seeded ${STRIPS.length} scrolling strips.`);

  for (const tile of TILES) {
    const existing = await prisma.smallBanner.findFirst({
      where: { name: tile.name, deleted_at: null },
    });

    if (existing) {
      await prisma.smallBanner.update({ where: { id: existing.id }, data: tile });
    } else {
      await prisma.smallBanner.create({ data: { ...tile, status: 1 } });
    }
  }
  console.log(`Seeded ${TILES.length} grid tiles (add images from the admin later).`);

  const featured = await prisma.product.count({
    where: { deleted_at: null, status: 1, is_featured: true },
  });

  console.log(
    featured > 0
      ? `${featured} product(s) are marked Featured and will fill the product row.`
      : "No products are marked Featured yet — tick Featured on a product to fill that row."
  );

  const hero = await prisma.homeVideoSection.count({
    where: { deleted_at: null, status: 1 },
  });

  console.log(
    hero > 0
      ? "A video section exists; set its link and standfirst from Admin → Videos."
      : "No hero video yet — upload one from Admin → Videos."
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
