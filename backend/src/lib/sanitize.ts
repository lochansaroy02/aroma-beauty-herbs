import sanitizeHtml from "sanitize-html";

/**
 * Cleans admin-authored rich text before it is stored.
 *
 * Runs in the API, on write — not in the Next server action, which anyone
 * holding an admin token can bypass by calling the API directly, and not at
 * render time, which would mean every reader pays for it and one forgotten
 * call site is an XSS hole.
 *
 * The allowlist is exactly what the editor's toolbar can produce. Anything the
 * toolbar can't emit has no business arriving here.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  // No data: or javascript: — images belong in the media pipeline, not pasted
  // into a description as a base64 blob.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  disallowedTagsMode: "discard",
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/**
 * An "empty" editor still serialises to `<p></p>`, so a required check on the
 * raw string would always pass. Both ends need the same rule or the client
 * blocks a save the server would have accepted, or worse, the reverse.
 */
export function isBlankRichText(html: string | null | undefined): boolean {
  if (!html) return true;
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .trim().length === 0;
}

/** Sanitises, then normalises a blank document to null for the column. */
export function cleanRichText(html: string | null | undefined): string | null {
  if (html === null || html === undefined) return null;
  const clean = sanitizeRichText(html);
  return isBlankRichText(clean) ? null : clean;
}
