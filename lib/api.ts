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
