import { useState, useEffect } from 'react';
import { getRooms } from '../lib/api';
import type { Room } from '../constants/mockData';

export function useRooms(buildingId: string) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getRooms(buildingId)
      .then(setRooms)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [buildingId]);

  return { rooms, loading, error };
}
