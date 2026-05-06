import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Building, Room, RouteOption } from "../constants/mockData";
import {
  getBuildings,
  getRooms,
  getRoutes,
  getCampusGraph,
  getCampusGraphVersion,
  type CampusGraphResponse,
} from "./api";

const CAMPUS_GRAPH_CACHE_KEY = "campus_graph_cache_v1";
const BUILDINGS_CACHE_KEY = "buildings_cache_v1";
const ROOMS_CACHE_PREFIX = "rooms_cache_v1:";
const ROUTES_CACHE_PREFIX = "routes_cache_v1:";

let _campusGraph: CampusGraphResponse | null = null;
let _buildings: Building[] = [];
const _rooms: Record<string, Room[]> = {};
const _routes: Record<string, RouteOption[]> = {};

export const getCachedBuildingsMemory = (): Building[] => _buildings;
export const getCachedRoomsMemory = (id: string): Room[] => _rooms[id] ?? [];
export const isBuildingsCachedMemory = (): boolean => _buildings.length > 0;
export const isRoomsCachedMemory = (id: string): boolean => id in _rooms;

function routeCacheKey(from: string, to: string) {
  return `${ROUTES_CACHE_PREFIX}${from}:${to}`;
}

export async function getCachedBuildings(): Promise<Building[]> {
  if (_buildings.length > 0) return _buildings;

  const raw = await AsyncStorage.getItem(BUILDINGS_CACHE_KEY);
  if (!raw) return [];

  try {
    _buildings = JSON.parse(raw) as Building[];
    return _buildings;
  } catch {
    await AsyncStorage.removeItem(BUILDINGS_CACHE_KEY);
    return [];
  }
}

export async function saveBuildingsCache(buildings: Building[]) {
  _buildings = buildings;
  await AsyncStorage.setItem(BUILDINGS_CACHE_KEY, JSON.stringify(buildings));
}

export async function refreshBuildingsCache() {
  const buildings = await getBuildings();
  await saveBuildingsCache(buildings);
  return buildings;
}

export async function getBuildingsCached(options?: { force?: boolean }) {
  if (!options?.force) {
    const cached = await getCachedBuildings();
    if (cached.length > 0) return cached;
  }

  return refreshBuildingsCache();
}

export async function getCachedRooms(buildingId: string): Promise<Room[]> {
  if (buildingId in _rooms) return _rooms[buildingId];

  const raw = await AsyncStorage.getItem(`${ROOMS_CACHE_PREFIX}${buildingId}`);
  if (!raw) return [];

  try {
    const rooms = JSON.parse(raw) as Room[];
    _rooms[buildingId] = rooms;
    return rooms;
  } catch {
    await AsyncStorage.removeItem(`${ROOMS_CACHE_PREFIX}${buildingId}`);
    return [];
  }
}

export async function saveRoomsCache(buildingId: string, rooms: Room[]) {
  _rooms[buildingId] = rooms;
  await AsyncStorage.setItem(
    `${ROOMS_CACHE_PREFIX}${buildingId}`,
    JSON.stringify(rooms),
  );
}

export async function getRoomsCached(
  buildingId: string,
  options?: { force?: boolean },
) {
  if (!options?.force) {
    const cached = await getCachedRooms(buildingId);
    if (cached.length > 0) return cached;
  }

  const rooms = await getRooms(buildingId);
  await saveRoomsCache(buildingId, rooms);
  return rooms;
}

export async function getRoutesCached(
  from: string,
  to: string,
  options?: { force?: boolean },
) {
  const memoryKey = `${from}:${to}`;

  if (!options?.force) {
    if (_routes[memoryKey]) return _routes[memoryKey];

    const raw = await AsyncStorage.getItem(routeCacheKey(from, to));
    if (raw) {
      try {
        const routes = JSON.parse(raw) as RouteOption[];
        _routes[memoryKey] = routes;
        return routes;
      } catch {
        await AsyncStorage.removeItem(routeCacheKey(from, to));
      }
    }
  }

  const routes = await getRoutes(from, to);
  _routes[memoryKey] = routes;
  await AsyncStorage.setItem(routeCacheKey(from, to), JSON.stringify(routes));
  return routes;
}

export async function getCachedCampusGraph(): Promise<CampusGraphResponse | null> {
  if (_campusGraph) return _campusGraph;

  const raw = await AsyncStorage.getItem(CAMPUS_GRAPH_CACHE_KEY);
  if (!raw) return null;

  try {
    _campusGraph = JSON.parse(raw) as CampusGraphResponse;
    return _campusGraph;
  } catch {
    await AsyncStorage.removeItem(CAMPUS_GRAPH_CACHE_KEY);
    return null;
  }
}

export async function saveCampusGraphCache(graph: CampusGraphResponse) {
  _campusGraph = graph;
  await AsyncStorage.setItem(CAMPUS_GRAPH_CACHE_KEY, JSON.stringify(graph));
}

export async function refreshCampusGraphCacheIfNeeded(): Promise<CampusGraphResponse> {
  const cached = await getCachedCampusGraph();

  // This is the one backend check you said you still want.
  const latestVersion = await getCampusGraphVersion();

  if (cached && cached.version.id === latestVersion.id) {
    return cached;
  }

  const freshGraph = await getCampusGraph();
  await saveCampusGraphCache(freshGraph);
  return freshGraph;
}