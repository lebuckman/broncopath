import { useState, useEffect } from 'react';
import { getBuildings } from '../lib/api';
import type { Building } from '../constants/mockData';

export function useBuildings() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getBuildings()
      .then(setBuildings)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { buildings, loading, error };
}
