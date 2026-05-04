// Mock data shaped to exactly match the API contracts in docs/contexts/REQUIREMENTS.md.
// When the backend is ready, swap the data source — not the components.

export type DensityLevel = 'low' | 'med' | 'high';

export interface Room {
  id: string;
  number: string;
  type: string;
  capacity: number;
  status: 'free' | 'busy' | 'soon';
  freesAt?: string;
  freeUntil?: string;
  courseName?: string;
}

export interface Building {
  id: string;
  name: string;
  code: string;
  occupancy: number;
  level: DensityLevel;
  roomCount: number;
  freeCount: number;
  latitude: number;
  longitude: number;
  updatedAt: string;
  rooms?: Room[];
}
