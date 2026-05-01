import { useState, useEffect } from "react";
import { getRooms } from "../lib/api";
import type { Room } from "../constants/mockData";

export function useRooms(buildingId: string) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!buildingId) {
      setRooms([]);
      setLoading(false);
      return;
    }

    function fetchRooms() {
      getRooms(buildingId)
        .then(setRooms)
        .catch(setError)
        .finally(() => setLoading(false));
    }

    setLoading(true);
    setError(null);
    fetchRooms();

    const id = setInterval(fetchRooms, 60_000);
    return () => clearInterval(id);
  }, [buildingId]);

  return { rooms, loading, error };
}
