import { useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    function startPolling() {
      fetchRooms();
      intervalRef.current = setInterval(fetchRooms, 300_000);
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Immediately swap to cached data for the new building (clears stale rooms from previous building)
    setRooms(getCachedRooms(buildingId));
    setLoading(!isRoomsCached(buildingId));
    setError(null);
    startPolling();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") startPolling();
      else stopPolling();
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  }, [buildingId]);

  return { rooms, loading, error };
}
