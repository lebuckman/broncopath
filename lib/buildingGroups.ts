import type { Building, Room } from '../constants/mockData';

export interface BuildingGroup {
  primary: Building;
  aliases: Building[];
  allIds: string[];
}

export interface BuildingSection {
  building: Building;
  rooms: Room[];
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

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Coordinate-based grouping (used by map — only same-location buildings share a marker)
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

// Prefix + proximity grouping (used by rooms tab — collapses sub-buildings of the
// same complex into one accordion regardless of coordinate differences, but requires
// all members to be within 500 m of the anchor to prevent false matches like 68/68A)
const SAME_COMPLEX_MAX_METERS = 500;

export function groupBuildingsByComplex(buildings: Building[]): BuildingGroup[] {
  if (!Array.isArray(buildings)) return [];

  const byPrefix = new Map<string, Building[]>();
  for (const b of buildings) {
    const key = b.id.match(/^(\d+)/)?.[1] ?? b.id;
    if (!byPrefix.has(key)) byPrefix.set(key, []);
    byPrefix.get(key)!.push(b);
  }

  const groups: BuildingGroup[] = [];

  for (const prefixGroup of byPrefix.values()) {
    if (prefixGroup.length === 1) {
      groups.push({ primary: prefixGroup[0], aliases: [], allIds: [prefixGroup[0].id] });
      continue;
    }

    const anchor = pickPrimary(prefixGroup);
    const nearby: Building[] = [];
    const isolated: Building[] = [];

    for (const b of prefixGroup) {
      if (haversineMeters(anchor.latitude, anchor.longitude, b.latitude, b.longitude) <= SAME_COMPLEX_MAX_METERS) {
        nearby.push(b);
      } else {
        isolated.push(b);
      }
    }

    const nearbyPrimary = pickPrimary(nearby);
    groups.push({
      primary: nearbyPrimary,
      aliases: nearby.filter((b) => b.id !== nearbyPrimary.id),
      allIds: nearby.map((b) => b.id),
    });

    for (const b of isolated) {
      groups.push({ primary: b, aliases: [], allIds: [b.id] });
    }
  }

  return groups;
}
