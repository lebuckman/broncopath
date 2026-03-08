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
  rooms: Room[];
}

export interface RouteStep {
  instruction: string;
}

export interface RouteOption {
  id: string;
  type: 'recommended' | 'fastest';
  title: string;
  walkMinutes: number;
  distanceM: number;
  crowdLevel: DensityLevel;
  steps: RouteStep[];
  crowdTip?: string;
}

export const BUILDINGS: Building[] = [
  {
    id: 'eng-9',
    name: 'Engineering Building',
    code: 'BLDG 9',
    occupancy: 88,
    level: 'high',
    roomCount: 5,
    freeCount: 2,
    latitude: 34.0582,
    longitude: -117.8218,
    updatedAt: '2026-03-08T09:00:00.000Z',
    rooms: [
      { id: '9-101', number: '9-101', type: 'Lecture Hall',  capacity: 120, status: 'busy' },
      { id: '9-201', number: '9-201', type: 'Computer Lab',  capacity: 40,  status: 'busy' },
      { id: '9-110', number: '9-110', type: 'Seminar Room',  capacity: 20,  status: 'free' },
      { id: '9-301', number: '9-301', type: 'Study Room',    capacity: 8,   status: 'free' },
      { id: '9-210', number: '9-210', type: 'Lab A',         capacity: 35,  status: 'busy' },
    ],
  },
  {
    id: 'lib-15',
    name: 'University Library',
    code: 'BLDG 15',
    occupancy: 62,
    level: 'med',
    roomCount: 5,
    freeCount: 3,
    latitude: 34.0569,
    longitude: -117.8205,
    updatedAt: '2026-03-08T09:00:00.000Z',
    rooms: [
      { id: 'l-1',     number: 'L-1',     type: 'Main Floor',   capacity: 200, status: 'busy' },
      { id: 'l-101',   number: 'L-101',   type: 'Study Room A', capacity: 6,   status: 'free' },
      { id: 'l-102',   number: 'L-102',   type: 'Study Room B', capacity: 6,   status: 'free' },
      { id: 'l-201',   number: 'L-201',   type: 'Quiet Zone',   capacity: 40,  status: 'free' },
      { id: 'l-group', number: 'L-Group', type: 'Group Room',   capacity: 8,   status: 'soon', freesAt: '10:00 AM' },
    ],
  },
  {
    id: 'biz-163',
    name: 'College of Business',
    code: 'BLDG 163',
    occupancy: 21,
    level: 'low',
    roomCount: 5,
    freeCount: 4,
    latitude: 34.0565,
    longitude: -117.8195,
    updatedAt: '2026-03-08T09:00:00.000Z',
    rooms: [
      { id: '163-101', number: '163-101', type: 'Lecture Hall', capacity: 80,  status: 'free' },
      { id: '163-102', number: '163-102', type: 'Lecture Hall', capacity: 60,  status: 'free' },
      { id: '163-201', number: '163-201', type: 'Seminar',      capacity: 25,  status: 'free' },
      { id: '163-210', number: '163-210', type: 'Conference',   capacity: 12,  status: 'free' },
      { id: '163-301', number: '163-301', type: 'Computer Lab', capacity: 30,  status: 'busy' },
    ],
  },
  {
    id: 'sci-8',
    name: 'Science Building',
    code: 'BLDG 8',
    occupancy: 79,
    level: 'high',
    roomCount: 5,
    freeCount: 2,
    latitude: 34.0578,
    longitude: -117.8200,
    updatedAt: '2026-03-08T09:00:00.000Z',
    rooms: [
      { id: '8-101', number: '8-101', type: 'Chem Lab',     capacity: 30,  status: 'busy' },
      { id: '8-102', number: '8-102', type: 'Bio Lab',      capacity: 30,  status: 'busy' },
      { id: '8-201', number: '8-201', type: 'Lecture Hall', capacity: 100, status: 'busy' },
      { id: '8-301', number: '8-301', type: 'Study Lounge', capacity: 20,  status: 'free' },
      { id: '8-110', number: '8-110', type: 'Conference',   capacity: 12,  status: 'free' },
    ],
  },
];

export const MOCK_ROUTES: RouteOption[] = [
  {
    id: 'route-1',
    type: 'recommended',
    title: 'Least Crowded Path',
    walkMinutes: 9,
    distanceM: 680,
    crowdLevel: 'low',
    steps: [
      { instruction: 'Head north on central walkway' },
      { instruction: 'Pass the fountain, bear left at the library' },
      { instruction: 'Continue along the east pedestrian path' },
      { instruction: 'Engineering Building is on your right' },
    ],
    crowdTip: 'Science Bldg 8 clears up around 10:15 AM — this path stays quiet until then.',
  },
  {
    id: 'route-2',
    type: 'fastest',
    title: 'Shortest Path',
    walkMinutes: 6,
    distanceM: 440,
    crowdLevel: 'high',
    steps: [
      { instruction: 'Head east past the Science Building' },
      { instruction: 'Cut through the B-5 parking structure walkway' },
      { instruction: 'Engineering Building entrance is straight ahead' },
    ],
  },
];