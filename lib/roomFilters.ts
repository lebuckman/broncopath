import type { Room } from "../constants/mockData";

export const FILTER_OPTIONS = [
  "All",
  "Free Now",
  "Frees Soon",
  "Free 2+ hrs",
  "35+ seats",
  "Labs",
  "Seminar",
  "Lecture",
];

export type FilterMode = "any" | "all";

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

export function roomMatchesFilter(room: Room, filter: string): boolean {
  if (filter === "Free Now") return room.status === "free";
  if (filter === "Frees Soon") return room.status === "soon";
  if (filter === "Free 2+ hrs") {
    if (room.status !== "free") return false;
    if (!room.freeUntil) return true;
    const t = parseTimeMs(room.freeUntil);
    return t !== null && t - Date.now() >= 2 * 60 * 60 * 1000;
  }
  if (filter === "35+ seats") return room.capacity >= 35;
  if (filter === "Labs") return room.type.toLowerCase().includes("lab");
  if (filter === "Seminar") return room.type.toLowerCase().includes("seminar");
  if (filter === "Lecture") return room.type.toLowerCase().includes("lecture");
  return true;
}

export function applyRoomFilters(
  room: Room,
  active: string[],
  mode: FilterMode,
): boolean {
  if (active.length === 0) return true;
  return mode === "all"
    ? active.every((f) => roomMatchesFilter(room, f))
    : active.some((f) => roomMatchesFilter(room, f));
}
