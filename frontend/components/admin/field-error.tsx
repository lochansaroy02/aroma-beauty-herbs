/**
 * Renders the first message for a field. Client-side validation and the API's
 * 422 body use the same `Record<string, string[]>` shape, so one component
 * covers both and an error reads identically whichever side produced it.
 */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-destructive">{messages[0]}</p>;
}
