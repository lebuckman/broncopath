import { useState, useEffect } from "react";
import { getRooms } from "../lib/api";
import type { Room } from "../constants/mockData";
import { getCachedRooms, isRoomsCached } from "../lib/dataCache";

export function useRooms(buildingId: string) {
  const [rooms, setRooms] = useState<Room[]>(() =>
    buildingId ? getCachedRooms(buildingId) : [],
  );
  const [loading, setLoading] = useState(() =>
    buildingId ? !isRoomsCached(buildingId) : false,
  );
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

    if (!isRoomsCached(buildingId)) setLoading(true);
    setError(null);
    fetchRooms();

    const id = setInterval(fetchRooms, 60_000);
    return () => clearInterval(id);
  }, [buildingId]);

  return { rooms, loading, error };
}
