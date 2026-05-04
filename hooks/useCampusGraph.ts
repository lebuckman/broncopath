import { useEffect, useState } from "react";
import type { CampusGraphResponse } from "../lib/api";
import { getCachedCampusGraph, refreshCampusGraphCacheIfNeeded } from "../lib/dataCache";

export function useCampusGraph() {
  const [graph, setGraph] = useState<CampusGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      try {
        const cached = await getCachedCampusGraph();

        if (!cancelled && cached) {
          setGraph(cached);
          setLoading(false);
        }

        setRefreshing(true);

        const graphResult = await refreshCampusGraphCacheIfNeeded();

        if (!cancelled) {
          setGraph(graphResult);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Graph load failed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    graph,
    loading,
    refreshing,
    error,
  };
}