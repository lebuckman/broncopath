// Fetch wrapper for the BroncoPath API.
// All functions currently return mock data.
// To switch to the live backend, uncomment the fetch call and remove the mock return.

import type { Building, Room, RouteOption } from '../constants/mockData';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export async function getBuildings(): Promise<Building[]> {
  return fetch(`${BASE_URL}/api/buildings`).then(r => r.json());
}

export async function getRooms(buildingId: string): Promise<Room[]> {
  return fetch(`${BASE_URL}/api/buildings/${buildingId}/rooms`).then(r => r.json());
}

export async function getRoutes(from: string, to: string): Promise<RouteOption[]> {
  return fetch(`${BASE_URL}/api/routes?from=${from}&to=${to}`).then(r => r.json());
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