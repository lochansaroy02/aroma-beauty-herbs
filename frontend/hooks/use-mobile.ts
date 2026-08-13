import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

/**
 * A media query is an external store, so subscribing to it with
 * useSyncExternalStore avoids the setState-in-effect pattern and gives the
 * server render an explicit value instead of a transient `undefined`.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // No viewport on the server — assume desktop, matching the sidebar default.
    () => false
  )
}
