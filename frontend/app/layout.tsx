import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Karla } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

/**
 * Three faces, three jobs.
 *
 * Fraunces is the voice — a variable serif with optical sizing and a "wonk"
 * axis, so headings at display size get the soft, slightly odd letterforms that
 * suit a herbal apothecary, while small settings stay upright and legible.
 * Karla carries body copy. IBM Plex Mono is reserved for the scrolling bands,
 * prices and eyebrows, where it reads as a botanical label rather than UI.
 */
const fraunces = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const karla = Karla({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aroma Beauty Herbs",
  description: "Herbal skincare, blended in small batches.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        fraunces.variable,
        karla.variable,
        plexMono.variable,
        "font-sans"
      )}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
