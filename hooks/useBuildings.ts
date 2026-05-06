import { useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { getBuildings } from "../lib/api";
import type { Building } from "../constants/mockData";
import { getCachedBuildings, isBuildingsCached } from "../lib/dataCache";

export function useBuildings() {
  const [buildings, setBuildings] = useState<Building[]>(() =>
    getCachedBuildings(),
  );
  const [loading, setLoading] = useState(() => !isBuildingsCached());
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function fetchBuildings() {
      getBuildings()
        .then((nextBuildings) => {
          setBuildings(Array.isArray(nextBuildings) ? nextBuildings : []);
        })
        .catch(setError)
        .finally(() => setLoading(false));
    }

    function startPolling() {
      fetchBuildings();
      intervalRef.current = setInterval(fetchBuildings, 300_000);
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

  function refresh() {
    return getBuildings()
      .then((data) => setBuildings(Array.isArray(data) ? data : []))
      .catch(setError);
  }

  return { buildings, loading, error, refresh };
}
