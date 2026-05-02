import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "broncopath:favorites";

export interface FavoriteEntry {
  roomId: string;
  buildingId: string;
}

// Module-level shared state — one source of truth across all hook instances
let globalFavorites: FavoriteEntry[] = [];
let globalLoaded = false;
const subscribers = new Set<() => void>();

function notifyAll() {
  subscribers.forEach((fn) => fn());
}

function persistAndNotify(next: FavoriteEntry[]) {
  globalFavorites = next;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  notifyAll();
}

export function useFavorites() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!globalLoaded) {
      globalLoaded = true;
      AsyncStorage.getItem(STORAGE_KEY)
        .then((raw) => {
          if (raw) globalFavorites = JSON.parse(raw);
          notifyAll();
        })
        .catch(() => {});
    }

    const rerender = () => forceUpdate((n) => n + 1);
    subscribers.add(rerender);
    return () => {
      subscribers.delete(rerender);
    };
  }, []);

  return {
    favorites: globalFavorites,
    isFavorite: (roomId: string) =>
      globalFavorites.some((f) => f.roomId === roomId),
    toggleFavorite: (roomId: string, buildingId: string) => {
      persistAndNotify(
        globalFavorites.some((f) => f.roomId === roomId)
          ? globalFavorites.filter((f) => f.roomId !== roomId)
          : [...globalFavorites, { roomId, buildingId }],
      );
    },
    getFavoriteRoomIds: (buildingId: string) =>
      globalFavorites
        .filter((f) => f.buildingId === buildingId)
        .map((f) => f.roomId),
    favoriteBuildingIds: [
      ...new Set(globalFavorites.map((f) => f.buildingId)),
    ],
  };
}
