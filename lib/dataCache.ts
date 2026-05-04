import type { Building, Room } from "../constants/mockData";
import { getBuildings, getRooms, getCampusGraph, type CampusGraphResponse } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CAMPUS_GRAPH_CACHE_KEY = "campus_graph_cache_v1";
const CAMPUS_GRAPH_VERSION_KEY = "campus_graph_version_v1";

let _campusGraph: CampusGraphResponse | null = null;
let _buildings: Building[] = [];
const _rooms: Record<string, Room[]> = {};

export const getCachedBuildings = (): Building[] => _buildings;
export const getCachedRooms = (id: string): Room[] => _rooms[id] ?? [];
export const isBuildingsCached = (): boolean => _buildings.length > 0;
export const isRoomsCached = (id: string): boolean => id in _rooms;

export async function prefetchBuildings(): Promise<void> {
  _buildings = await getBuildings();
}

export async function prefetchRooms(): Promise<void> {
  await Promise.all(
    _buildings.map(async (b) => {
      _rooms[b.id] = await getRooms(b.id);
    }),
  );
}

export function getCachedCampusGraphMemory(): CampusGraphResponse | null {
  return _campusGraph;
}

export async function getCachedCampusGraph(): Promise<CampusGraphResponse | null> {
  if (_campusGraph) return _campusGraph;

  const raw = await AsyncStorage.getItem(CAMPUS_GRAPH_CACHE_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CampusGraphResponse;
    _campusGraph = parsed;
    return parsed;
  } catch {
    await AsyncStorage.removeItem(CAMPUS_GRAPH_CACHE_KEY);
    await AsyncStorage.removeItem(CAMPUS_GRAPH_VERSION_KEY);
    return null;
  }
}

export async function saveCampusGraphCache(
  graph: CampusGraphResponse,
): Promise<void> {
  _campusGraph = graph;

  await AsyncStorage.multiSet([
    [CAMPUS_GRAPH_CACHE_KEY, JSON.stringify(graph)],
    [CAMPUS_GRAPH_VERSION_KEY, graph.version.id],
  ]);
}

export async function clearCampusGraphCache(): Promise<void> {
  _campusGraph = null;

  await AsyncStorage.multiRemove([
    CAMPUS_GRAPH_CACHE_KEY,
    CAMPUS_GRAPH_VERSION_KEY,
  ]);
}

export async function refreshCampusGraphCache(): Promise<CampusGraphResponse> {
  const graph = await getCampusGraph();
  await saveCampusGraphCache(graph);
  return graph;
}