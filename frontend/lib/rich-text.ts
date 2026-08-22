import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Cleans product copy that came from barbersyndicate.in before it is rendered.
 *
 * The catalogue is authored in someone else's admin and arrives as raw HTML, so
 * it is untrusted input to this app no matter how friendly the source: anything
 * that could inject a script into a page of ours is stripped at the boundary,
 * once, on the server, rather than trusted because of where it came from.
 *
 * The allowlist is the formatting the descriptions actually use — the API's
 * copy is paragraphs, bold, lists and headings, decorated with `data-start` /
 * `data-end` attributes that carry no meaning here and are dropped.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
    "span",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  // No style or class: this site's own typography should win, and a pasted
  // style attribute is the usual way foreign copy breaks a careful layout.
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  disallowedTagsMode: "discard",
  transformTags: {
    // Every link here points off-site, so it opens in a new tab and carries the
    // rel that stops the opened page reaching back through window.opener.
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }),
  },
};

/** Sanitised HTML, or null when there was nothing worth rendering. */
export function cleanRichText(html: string | null | undefined): string | null {
  if (!html) return null;

  const clean = sanitizeHtml(html, OPTIONS);

  // An "empty" document is often still `<p></p>` or a stray &nbsp;, which would
  // otherwise render as a blank block with margins around it.
  const text = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .trim();

  return text.length ? clean : null;
}
