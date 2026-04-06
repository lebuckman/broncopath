import { db } from './index.js';
import { buildings, rooms } from './schema.js';

await db.insert(buildings).values([
    { id: 'eng-9',   name: 'Engineering Building', code: 'BLDG 9',   latitude: 34.05886, longitude: -117.82222 },
    { id: 'lib-15',  name: 'University Library',   code: 'BLDG 15',  latitude: 34.05750, longitude: -117.82138 },
    { id: 'biz-163', name: 'College of Business',  code: 'BLDG 163', latitude: 34.06159, longitude: -117.81964 },
    { id: 'sci-8',   name: 'Science Building',     code: 'BLDG 8',   latitude: 34.05862, longitude: -117.82485 },
]);

await db.insert(rooms).values([
  // Engineering
    { id: '9-101', buildingId: 'eng-9', number: '9-101', type: 'Lecture Hall',  capacity: 120 },
    { id: '9-201', buildingId: 'eng-9', number: '9-201', type: 'Computer Lab',  capacity: 40  },
    { id: '9-110', buildingId: 'eng-9', number: '9-110', type: 'Seminar Room',  capacity: 20  },
    { id: '9-301', buildingId: 'eng-9', number: '9-301', type: 'Study Room',    capacity: 8   },
    { id: '9-210', buildingId: 'eng-9', number: '9-210', type: 'Lab A',         capacity: 35  },
  // Library
    { id: 'l-1',     buildingId: 'lib-15', number: 'L-1',     type: 'Main Floor',   capacity: 200 },
    { id: 'l-101',   buildingId: 'lib-15', number: 'L-101',   type: 'Study Room A', capacity: 6   },
    { id: 'l-102',   buildingId: 'lib-15', number: 'L-102',   type: 'Study Room B', capacity: 6   },
    { id: 'l-201',   buildingId: 'lib-15', number: 'L-201',   type: 'Quiet Zone',   capacity: 40  },
    { id: 'l-group', buildingId: 'lib-15', number: 'L-Group', type: 'Group Room',   capacity: 8   },
  // Business
    { id: '163-101', buildingId: 'biz-163', number: '163-101', type: 'Lecture Hall', capacity: 80 },
    { id: '163-102', buildingId: 'biz-163', number: '163-102', type: 'Lecture Hall', capacity: 60 },
    { id: '163-201', buildingId: 'biz-163', number: '163-201', type: 'Seminar',      capacity: 25 },
    { id: '163-210', buildingId: 'biz-163', number: '163-210', type: 'Conference',   capacity: 12 },
    { id: '163-301', buildingId: 'biz-163', number: '163-301', type: 'Computer Lab', capacity: 30 },
  // Science
      { id: '8-101', buildingId: 'sci-8', number: '8-101', type: 'Chem Lab',     capacity: 30  },
    { id: '8-102', buildingId: 'sci-8', number: '8-102', type: 'Bio Lab',      capacity: 30  },
    { id: '8-201', buildingId: 'sci-8', number: '8-201', type: 'Lecture Hall', capacity: 100 },
    { id: '8-301', buildingId: 'sci-8', number: '8-301', type: 'Study Lounge', capacity: 20  },
    { id: '8-110', buildingId: 'sci-8', number: '8-110', type: 'Conference',   capacity: 12  },
]);

console.log('Seeded buildings and rooms');
process.exit(0);