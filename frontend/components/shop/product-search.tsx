"use client";

import { ImageIcon, Loader2Icon, SearchIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  formatPrice,
  MIN_QUERY_LENGTH,
  type ProductListItem,
} from "@/lib/catalog";
import { searchProductsAction, type SearchResult } from "@/lib/search-actions";

/** Long enough to skip the middle of a word, short enough to feel live. */
const DEBOUNCE_MS = 250;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; products: ProductListItem[]; total: number }
  | { kind: "error"; message: string };

export function ProductSearch() {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  // Every keystroke starts a request, and they can land out of order. Only the
  // newest one is allowed to write to state, so a slow early response can't
  // overwrite the results for what's currently in the box.
  const latest = useRef(0);

  const query = term.trim();
  const active = query.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    // Bumped even when the term is too short, which retires any request still
    // in flight from a longer one.
    const ticket = (latest.current += 1);
    if (!active) return;

    const timer = setTimeout(() => {
      setState({ kind: "loading" });

      void searchProductsAction(query).then((result: SearchResult) => {
        if (ticket !== latest.current) return;

        setState(
          result.ok
            ? { kind: "results", products: result.products, total: result.total }
            : { kind: "error", message: result.error }
        );
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, active]);

  // Derived rather than stored: below the minimum there is nothing to show, and
  // last search's results must not linger behind a half-deleted term.
  const view: State = active ? state : { kind: "idle" };

  /** Enter hands the query to the catalogue page, which paginates properly. */
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!query) return;

    // change(), not setOpen(): closing has to clear the term too, or the next
    // open starts with this search still in the box and types onto the end.
    change(false);
    router.push(`/products?search=${encodeURIComponent(query)}`);
  }

  // A fresh panel each time it opens; a stale term from last time is never
  // what someone means to search for now.
  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      setTerm("");
      setState({ kind: "idle" });
    }
  }

  const showing = view.kind === "results" ? view.products : [];

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Search the shop"
            className="rounded-full p-2 text-ink transition-colors hover:bg-ink/5"
          />
        }
      >
        <SearchIcon className="size-[18px]" strokeWidth={1.5} />
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        // Opaque rather than the shared translucent scrim: the page behind is a
        // busy catalogue, and anything showing through competes with the
        // results you're reading.
        overlayClassName="bg-ink/95"
        // Sits high rather than centred: the results grow downward, and a
        // centred panel would jump as they arrive. Overriding the shared
        // top/left/translate rather than adding to them.
        className="top-16 left-1/2 max-h-[calc(100vh-6rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 translate-y-0 gap-0 overflow-hidden rounded-2xl bg-paper p-0 text-ink sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search products</DialogTitle>
        <DialogDescription className="sr-only">
          Type at least {MIN_QUERY_LENGTH} characters to see matching products.
        </DialogDescription>

        <form onSubmit={submit} className="flex items-center gap-3 border-b border-ink/10 px-4">
          <SearchIcon className="size-[18px] shrink-0 text-ink-soft" strokeWidth={1.5} />

          <input
            autoFocus
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            aria-controls={listId}
            enterKeyHint="search"
            maxLength={120}
            className="min-w-0 flex-1 bg-transparent py-4 text-base text-ink outline-none placeholder:text-ink-soft/70 [&::-webkit-search-cancel-button]:appearance-none"
          />

          {view.kind === "loading" ? (
            <Loader2Icon className="size-4 shrink-0 animate-spin text-ink-soft" />
          ) : null}

          <DialogClose
            render={
              <button
                type="button"
                className="shrink-0 rounded-full px-2 py-1 font-mono text-[11px] tracking-[0.14em] text-ink-soft uppercase transition-colors hover:text-ink"
              />
            }
          >
            Esc
          </DialogClose>
        </form>

        <div id={listId} className="max-h-[60vh] overflow-y-auto overscroll-contain">
          {view.kind === "error" ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">{view.message}</p>
          ) : view.kind === "idle" ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">
              {query.length > 0
                ? `Keep typing — ${MIN_QUERY_LENGTH} characters minimum.`
                : "Search by product name or code."}
            </p>
          ) : showing.length === 0 && view.kind === "results" ? (
            <p className="px-4 py-8 text-center text-sm text-ink-soft">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-ink/5">
              {showing.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.slug}`}
                    onClick={() => change(false)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.04]"
                  >
                    <div className="relative size-12 shrink-0 overflow-hidden rounded bg-paper-deep">
                      {product.primary_image ? (
                        <Image
                          src={product.primary_image.url}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-ink-soft">
                          <ImageIcon className="size-4" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{product.product_name}</p>
                      <p className="truncate text-xs text-ink-soft">
                        {product.in_stock ? (
                          product.price ? (
                            <>
                              {product.price.from ? "From " : ""}
                              {formatPrice(product.price.sale_price)}
                            </>
                          ) : (
                            "Price on request"
                          )
                        ) : (
                          "Out of stock"
                        )}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Only worth offering once there's more than the panel is showing. */}
          {view.kind === "results" && view.total > showing.length ? (
            <div className="border-t border-ink/10">
              <Link
                href={`/products?search=${encodeURIComponent(query)}`}
                onClick={() => change(false)}
                className="block px-4 py-3 text-center font-mono text-[11px] tracking-[0.14em] text-ink-soft uppercase transition-colors hover:bg-ink/[0.04] hover:text-ink"
              >
                See all {view.total} results
              </Link>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
