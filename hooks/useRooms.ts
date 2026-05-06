import { useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { Room } from "../constants/mockData";
import {
  getRoomsCached,
  getCachedRoomsMemory,
  isRoomsCachedMemory,
} from "../lib/dataCache";

export function useRooms(buildingId: string) {
  const [rooms, setRooms] = useState<Room[]>(() =>
    buildingId ? getCachedRoomsMemory(buildingId) : [],
  );
  const [loading, setLoading] = useState(() =>
    buildingId ? !isRoomsCachedMemory(buildingId) : false,
  );
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!buildingId) {
      setRooms([]);
      setLoading(false);
      return;
    }

    async function fetchRooms(force = false) {
      try {
        const result = await getRoomsCached(buildingId, { force });
        setRooms(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch rooms"));
      } finally {
        setLoading(false);
      }
    }

    function startPolling() {
      // Immediately show cached data for this building before network fetch
      setRooms(getCachedRoomsMemory(buildingId));
      setLoading(!isRoomsCachedMemory(buildingId));
      setError(null);
      fetchRooms();
      intervalRef.current = setInterval(() => fetchRooms(true), 300_000);
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

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