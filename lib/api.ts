// Fetch wrapper for the BroncoPath API.
// All functions currently return mock data.
// To switch to the live backend, uncomment the fetch call and remove the mock return.

import { BUILDINGS, MOCK_ROUTES } from '../constants/mockData';
import type { Building, Room, RouteOption } from '../constants/mockData';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export async function getBuildings(): Promise<Building[]> {
  // return fetch(`${BASE_URL}/api/buildings`).then(r => r.json());
  void BASE_URL;
  return Promise.resolve(BUILDINGS);
}

export async function getRooms(buildingId: string): Promise<Room[]> {
  // return fetch(`${BASE_URL}/api/buildings/${buildingId}/rooms`).then(r => r.json());
  const building = BUILDINGS.find(b => b.id === buildingId);
  return Promise.resolve(building?.rooms ?? []);
}

export async function getRoutes(from: string, to: string): Promise<RouteOption[]> {
  // return fetch(`${BASE_URL}/api/routes?from=${from}&to=${to}`).then(r => r.json());
  void from; void to;
  return Promise.resolve(MOCK_ROUTES);
}
