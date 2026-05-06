import type { RoutingGraph } from "../lib/routing/types";
import type { CongestionMap } from "../lib/routing/congestion";

// Congestion map computation (buildCongestionMap) runs synchronously on the JS
// thread and requires ~2500 Dijkstra calls on a 6k-node graph — too slow for
// client-side execution. Stubbed until the backend precomputes and serves this.
export function useCongestion(_graph: RoutingGraph | null): {
  congestion: CongestionMap | null;
  loading: boolean;
  error: Error | null;
} {
  return { congestion: null, loading: false, error: null };
}
