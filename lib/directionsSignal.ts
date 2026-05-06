// Module-level pub/sub so any component can close all open DirectionsButtons.
const subscribers = new Set<() => void>();

export function closeAllDirectionButtons() {
  subscribers.forEach((fn) => fn());
}

export function subscribeToDirectionsClose(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
