import type { Building } from '../constants/mockData';

export interface BuildingGroup {
  primary: Building;
  aliases: Building[];
  allIds: string[];
}

function coordKey(b: Building): string {
  return `${b.latitude.toFixed(4)},${b.longitude.toFixed(4)}`;
}

function pickPrimary(group: Building[]): Building {
  return group.slice().sort((a, b) => {
    const aNumeric = /^\d+$/.test(a.id);
    const bNumeric = /^\d+$/.test(b.id);
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    if (a.id.length !== b.id.length) return a.id.length - b.id.length;
    return a.id.localeCompare(b.id);
  })[0];
}

export function groupBuildings(buildings: Building[]): BuildingGroup[] {
  if (!Array.isArray(buildings)) return [];
  const byCoord = new Map<string, Building[]>();
  for (const b of buildings) {
    const key = coordKey(b);
    if (!byCoord.has(key)) byCoord.set(key, []);
    byCoord.get(key)!.push(b);
  }
  return [...byCoord.values()].map((group) => {
    const primary = pickPrimary(group);
    return {
      primary,
      aliases: group.filter((b) => b.id !== primary.id),
      allIds: group.map((b) => b.id),
    };
  });
}
