import { useState, useEffect } from "react";
import { getBuildings } from "../lib/api";
import type { Building } from "../constants/mockData";
import { getCachedBuildings, isBuildingsCached } from "../lib/dataCache";

export function useBuildings() {
  const [buildings, setBuildings] = useState<Building[]>(() =>
    getCachedBuildings(),
  );
  const [loading, setLoading] = useState(() => !isBuildingsCached());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    function fetchBuildings() {
      getBuildings()
        .then((nextBuildings) => {
          setBuildings(Array.isArray(nextBuildings) ? nextBuildings : []);
        })
        .catch(setError)
        .finally(() => setLoading(false));
    }

    fetchBuildings();

    const id = setInterval(fetchBuildings, 60_000);
    return () => clearInterval(id);
  }, []);

  function refresh() {
    return getBuildings().then(setBuildings).catch(setError);
  }

  return { buildings, loading, error, refresh };
}
