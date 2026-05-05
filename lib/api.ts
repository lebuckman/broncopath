// Fetch wrapper for the BroncoPath API.
// All functions currently return mock data.
// To switch to the live backend, uncomment the fetch call and remove the mock return.

import type { Building, Room, RouteOption } from '../constants/mockData';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export async function getBuildings(): Promise<Building[]> {
  const response = await fetch(`${BASE_URL}/api/buildings`);

  if (!response.ok) {
    throw new Error(`Failed to fetch buildings: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid buildings response: expected array");
  }

  return data;
}

export async function getRooms(buildingId: string): Promise<Room[]> {
  const response = await fetch(`${BASE_URL}/api/buildings/${buildingId}/rooms`);

  if (!response.ok) {
    throw new Error(`Failed to fetch rooms: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid rooms response: expected array");
  }

  return data;
}

export async function getRoutes(from: string, to: string): Promise<RouteOption[]> {
  const response = await fetch(`${BASE_URL}/api/routes?from=${from}&to=${to}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch route: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid routes response: expected array");
  }

  return data;
}

export async function getCampusGraph(): Promise<CampusGraphResponse> {
  const response = await fetch(`${BASE_URL}/api/campus-graph/latest`);

  if (!response.ok) {
    throw new Error(`Failed to fetch campus graph: ${response.status}`);
  }

  return response.json();
}

export async function getCampusGraphVersion(): Promise<CampusGraphVersion> {
  const response = await fetch(`${BASE_URL}/api/campus-graph/version`);

  if (!response.ok) {
    throw new Error(`Failed to fetch campus graph version: ${response.status}`);
  }

  return response.json();
}

export type CampusGraphVersion = {
  id: string;
  campusId: string;
  source: string;
  osmRelationId: string;
  fetchedAt: string | null;
  activatedAt: string | null;
};

export type CampusGraphNode = {
  id: string;
  graphVersionId: string;
  osmNodeId: string;
  lat: number;
  lng: number;
  type: string;
  label: string | null;
};

export type CampusGraphEdge = {
  id: string;
  graphVersionId: string;
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  walkTimeSeconds: number;
  highwayType: string | null;
  surface: string | null;
  incline: string | null;
  isStairs: boolean;
  accessibilityPenalty: number;
  geometry: [number, number][];
};

export type CampusGraphResponse = {
  version: CampusGraphVersion;
  nodes: CampusGraphNode[];
  edges: CampusGraphEdge[];
};