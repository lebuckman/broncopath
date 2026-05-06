import { useEffect, useState } from "react";
import { fetchClassSchedule } from "../lib/api";
import {
  buildCongestionMap,
  type CongestionMap,
} from "../lib/routing/congestion";
import type { RoutingGraph } from "../lib/routing/types";

const congestionCache = new Map<string, CongestionMap>();

function getGraphCacheKey(graph: RoutingGraph) {
  const nodeCount = Object.keys(graph.nodes).length;
  const edgeCount = Object.values(graph.adjacency).reduce(
    (sum, edges) => sum + edges.length,
    0,
  );

  return `${nodeCount}:${edgeCount}`;
}

export function useCongestion(graph: RoutingGraph | null) {
  const [congestion, setCongestion] = useState<CongestionMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!graph) {
      setCongestion(null);
      return;
    }

    const usableGraph = graph;
    let cancelled = false;

    async function load() {
      const cacheKey = getGraphCacheKey(usableGraph);

      const cached = congestionCache.get(cacheKey);
      if (cached) {
        setCongestion(cached);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const schedule = await fetchClassSchedule();
        const built = buildCongestionMap(usableGraph, schedule);

        congestionCache.set(cacheKey, built);

        if (!cancelled) {
          setCongestion(built);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to load congestion"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [graph]);

  return {
    congestion,
    loading,
    error,
  };
}