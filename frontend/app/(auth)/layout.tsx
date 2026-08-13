import Link from "next/link";
import { LeafIcon } from "lucide-react";

const BOTANICALS = ["Neem", "Tulsi", "Vetiver", "Kashmiri rose", "Sandalwood"];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col lg:grid lg:grid-cols-2">
      {/* Brand panel — quiet on purpose; the form is where the work happens. */}
      <aside className="flex flex-col justify-between gap-8 border-b bg-muted/40 px-6 py-8 sm:px-10 lg:border-r lg:border-b-0 lg:px-14 lg:py-14">
        <Link href="/" className="flex items-center gap-2 font-heading text-xl">
          <LeafIcon className="size-5 text-primary" />
          Aroma Beauty Herbs
        </Link>

        <p className="max-w-sm font-heading text-2xl leading-snug text-balance lg:text-4xl">
          Skincare blended in small batches, from plants we can name.
        </p>

        <div className="hidden lg:block">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Blended with
          </p>
          <ul className="mt-3 space-y-1.5">
            {BOTANICALS.map((botanical) => (
              <li
                key={botanical}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="size-1 rounded-full bg-primary" aria-hidden />
                {botanical}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:py-14">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}