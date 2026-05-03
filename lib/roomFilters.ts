import type { Room } from "../constants/mockData";

export type FilterMode = "any" | "all";

export interface FilterGroup {
  label: string;
  options: string[];
}

export const FILTER_GROUPS: FilterGroup[] = [
  {
    label: "Availability",
    options: ["Free Now", "Free Soon", "Free 2+ hrs", "Busy"],
  },
  {
    label: "Type",
    options: ["Lecture", "Lab", "Seminar"],
  },
  {
    label: "Seats",
    options: ["Small (≤10)", "Medium (11–35)", "Large (36+)"],
  },
];

function parseTimeMs(time12: string): number | null {
  const m = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  const period = m[3]!.toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.getTime();
}

export function roomMatchesFilter(
  room: Room,
  filter: string,
  favorites?: string[],
): boolean {
  if (filter === "Favorites") return favorites?.includes(room.id) ?? false;
  if (filter === "Free Now") return room.status === "free";
  if (filter === "Free Soon") return room.status === "soon";
  if (filter === "Free 2+ hrs") {
    if (room.status !== "free") return false;
    if (!room.freeUntil) return true;
    const t = parseTimeMs(room.freeUntil);
    return t !== null && t - Date.now() >= 2 * 60 * 60 * 1000;
  }
  if (filter === "Busy") return room.status === "busy";
  if (filter === "Small (≤10)") return room.capacity > 0 && room.capacity <= 10;
  if (filter === "Medium (11–35)") return room.capacity >= 11 && room.capacity <= 35;
  if (filter === "Large (36+)") return room.capacity >= 36;
  if (filter === "Lecture") return room.type.toLowerCase().includes("lecture");
  if (filter === "Lab") return room.type.toLowerCase().includes("lab");
  if (filter === "Seminar") return room.type.toLowerCase().includes("seminar");
  return true;
}

export function applyRoomFilters(
  room: Room,
  active: string[],
  mode: FilterMode,
  favorites?: string[],
): boolean {
  if (active.length === 0) return true;
  return mode === "all"
    ? active.every((f) => roomMatchesFilter(room, f, favorites))
    : active.some((f) => roomMatchesFilter(room, f, favorites));
}
