import type { Building, Room } from "../constants/mockData";
import { getBuildings, getRooms } from "./api";

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
