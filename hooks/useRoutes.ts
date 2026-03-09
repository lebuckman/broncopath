import { useState, useEffect } from 'react';
import { getRoutes } from '../lib/api';
import type { RouteOption } from '../constants/mockData';

export function useRoutes(from: string, to: string) {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    getRoutes(from, to)
      .then(setRoutes)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [from, to]);

  return { routes, loading, error };
}
