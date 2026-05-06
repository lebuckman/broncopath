import { useState, useEffect } from "react";
import type { RouteOption } from "../constants/mockData";
import { getRoutesCached } from "../lib/dataCache";

export function useRoutes(from: string, to: string) {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(Boolean(from && to));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!from || !to) {
      setRoutes([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRoutes() {
      try {
        setLoading(true);
        setError(null);

        const result = await getRoutesCached(from, to);

        if (!cancelled) {
          setRoutes(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch routes"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRoutes();

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return { routes, loading, error };
}