// Lets a one-off action (like the demo scenario trigger) tell any mounted
// map/queue to refetch immediately, instead of waiting out its normal poll
// interval — same pub/sub-over-DOM-event pattern as confirmFlash.ts.
export function triggerEventsRefresh() {
  window.dispatchEvent(new CustomEvent('ibvap:events-refresh'))
}
