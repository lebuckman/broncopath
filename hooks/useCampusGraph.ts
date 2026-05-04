import { useEffect, useState } from "react";
import type { CampusGraphResponse } from "../lib/api";
import { getCachedCampusGraph, refreshCampusGraphCache } from "../lib/dataCache";

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

        const fresh = await refreshCampusGraphCache();

        if (!cancelled) {
          setGraph(fresh);
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