import { useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { Building } from "../constants/mockData";
import {
  getBuildingsCached,
  getCachedBuildingsMemory,
  isBuildingsCachedMemory,
} from "../lib/dataCache";

export function useBuildings() {
  const [buildings, setBuildings] = useState<Building[]>(() =>
    getCachedBuildingsMemory(),
  );
  const [loading, setLoading] = useState(() => !isBuildingsCachedMemory());
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchBuildings(force = false) {
      try {
        const result = await getBuildingsCached({ force });
        setBuildings(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch buildings"));
      } finally {
        setLoading(false);
      }
    }

    function startPolling() {
      fetchBuildings();
      intervalRef.current = setInterval(() => fetchBuildings(true), 300_000);
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
  }, []);

  async function refresh(): Promise<Building[]> {
    const result = await getBuildingsCached({ force: true });
    setBuildings(result);
    return result;
  }

  return { buildings, loading, error, refresh };
}