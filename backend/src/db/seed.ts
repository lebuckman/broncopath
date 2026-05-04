import { sql } from 'drizzle-orm';
import { db } from './index.ts';
import { buildings, rooms } from './schema.ts';

// Upsert all buildings — safe to re-run against an already-seeded DB.
// Coordinates sourced from OpenStreetMap (overpass-api), with user-verified
// precision for buildings 8, 9, 80, 98, 162, 163, 209.
await db.insert(buildings).values([
  { id: '1',   name: 'Building One',                               code: 'BLDG 1',   latitude: 34.0597641, longitude: -117.8243934 },
  { id: '2',   name: 'College of Agriculture',                     code: 'BLDG 2',   latitude: 34.0577026, longitude: -117.8266561 },
  { id: '3',   name: 'Science Laboratory',                         code: 'BLDG 3',   latitude: 34.0581567, longitude: -117.8255640 },
  { id: '4',   name: 'Biotechnology',                              code: 'BLDG 4',   latitude: 34.0575077, longitude: -117.8253518 },
  { id: '4a',  name: 'BioTrek Learning Center',                    code: 'BLDG 4A',  latitude: 34.0572321, longitude: -117.8260988 },
  { id: '5',   name: 'College of Letters, Arts & Social Sciences', code: 'BLDG 5',   latitude: 34.0577361, longitude: -117.8244789 },
  { id: '6',   name: 'College of Education & Integrative Studies', code: 'BLDG 6',   latitude: 34.0585881, longitude: -117.8228503 },
  { id: '7',   name: 'College of Environmental Design',            code: 'BLDG 7',   latitude: 34.0572440, longitude: -117.8273573 },
  { id: '8',   name: 'College of Science',                         code: 'BLDG 8',   latitude: 34.058631959558056, longitude: -117.82485754663578 },
  { id: '9',   name: 'College of Engineering',                     code: 'BLDG 9',   latitude: 34.059166950291804, longitude: -117.82230931109463 },
  { id: '13',  name: 'Art Department & Engineering Annex',         code: 'BLDG 13',  latitude: 34.0587715, longitude: -117.8208259 },
  { id: '29',  name: 'W.K. Kellogg Arabian Horse Center',           code: 'BLDG 29',  latitude: 34.058613,  longitude: -117.814904  },
  { id: '29b', name: 'Building 29B',                               code: 'BLDG 29B', latitude: 34.058613,  longitude: -117.814904  },
  { id: '29B', name: 'Building 29B',                               code: 'BLDG 29B', latitude: 34.058613,  longitude: -117.814904  },
  { id: '15',  name: 'University Library',                         code: 'BLDG 15',  latitude: 34.057919,  longitude: -117.821342  },
  { id: '17',  name: 'Engineering Laboratories',                   code: 'BLDG 17',  latitude: 34.0600385, longitude: -117.8215666 },
  { id: '24',  name: 'Music',                                      code: 'BLDG 24',  latitude: 34.0567287, longitude: -117.8228927 },
  { id: '25',  name: 'Drama Department & Theatre',                 code: 'BLDG 25',  latitude: 34.0564464, longitude: -117.8221233 },
  { id: '26',  name: 'Union Plaza',                                code: 'BLDG 26',  latitude: 34.0569959, longitude: -117.8203586 },
  { id: '35',  name: 'Bronco Student Center',                      code: 'BLDG 35',  latitude: 34.0561815, longitude: -117.8212752 },
  { id: '35a', name: 'Art Gallery',                                code: 'BLDG 35A', latitude: 34.0569533, longitude: -117.8217859 },
  { id: '41',  name: 'Darlene May Gymnasium',                      code: 'BLDG 41',  latitude: 34.0540700, longitude: -117.8212962 },
  { id: '43',  name: 'Kellogg Arena',                              code: 'BLDG 43',  latitude: 34.0542173, longitude: -117.8192386 },
  { id: '45',  name: 'Apparel Merchandising & Management',         code: 'BLDG 45',  latitude: 34.0611014, longitude: -117.8111312 },
  { id: '46',  name: 'Health Services',                            code: 'BLDG 46',  latitude: 34.0578086, longitude: -117.8280291 },
  { id: '59',  name: 'La Cienega Center & Housing Services',       code: 'BLDG 59',  latitude: 34.0609775, longitude: -117.8219511 },
  { id: '66',  name: 'Bronco Bookstore',                           code: 'BLDG 66',  latitude: 34.0559701, longitude: -117.8204667 },
  { id: '72',  name: 'Centerpointe Dining Commons',                code: 'BLDG 72',  latitude: 34.0567790, longitude: -117.8187697 },
  { id: '78',  name: 'Kellogg West Conference Center',             code: 'BLDG 78',  latitude: 34.0567878, longitude: -117.8257224 },
  { id: '79',  name: 'Collins College of Hospitality Management',  code: 'BLDG 79',  latitude: 34.0550002, longitude: -117.8240188 },
  { id: '79a', name: 'Collins College of Hospitality Management A', code: 'BLDG 79A', latitude: 34.0553211, longitude: -117.8244473 },
  { id: '79b', name: 'Collins College of Hospitality Management B', code: 'BLDG 79B', latitude: 34.0550682, longitude: -117.8248439 },
  { id: '80',  name: 'Building 80',                                code: 'BLDG 80',  latitude: 34.054991716613685, longitude: -117.82540260699035 },
  { id: '89',  name: 'Interim Design Center',                      code: 'BLDG 89',  latitude: 34.0605235, longitude: -117.8123327 },
  { id: '89a', name: 'Interim Design Center A',                    code: 'BLDG 89A', latitude: 34.0605235, longitude: -117.8123327 },
  { id: '89A', name: 'Interim Design Center A',                    code: 'BLDG 89A', latitude: 34.0605235, longitude: -117.8123327 },
  { id: '89b', name: 'Interim Design Center B',                    code: 'BLDG 89B', latitude: 34.0605235, longitude: -117.8123327 },
  { id: '92',  name: 'Laboratory Facility',                       code: 'BLDG 92',  latitude: 34.0578020, longitude: -117.8261738 },
  { id: '95',  name: 'Cultural Centers',                           code: 'BLDG 95',  latitude: 34.0579340, longitude: -117.8226708 },
  { id: '97',  name: 'Campus Center Marketplace',                  code: 'BLDG 97',  latitude: 34.0577361, longitude: -117.8232939 },
  { id: '98',  name: 'Building 98',                                code: 'BLDG 98',  latitude: 34.059997,  longitude: -117.819818  },
  { id: '98c', name: 'Building 98C',                               code: 'BLDG 98C', latitude: 34.059997,  longitude: -117.819818  },
  { id: '98C', name: 'Building 98C',                               code: 'BLDG 98C', latitude: 34.059997,  longitude: -117.819818  },
  { id: '98p', name: 'Building 98P',                               code: 'BLDG 98P', latitude: 34.059997,  longitude: -117.819818  },
  { id: '98P', name: 'Building 98P',                               code: 'BLDG 98P', latitude: 34.059997,  longitude: -117.819818  },
  { id: '109', name: 'Police & Parking Services',                  code: 'BLDG 109', latitude: 34.0607683, longitude: -117.8158199 },
  { id: '111', name: 'Manor House',                                code: 'BLDG 111', latitude: 34.0605229, longitude: -117.8229261 },
  { id: '116', name: 'Child Care Center',                          code: 'BLDG 116', latitude: 34.0560537, longitude: -117.8194198 },
  { id: '158', name: 'Orientation Services',                       code: 'BLDG 158', latitude: 34.0567202, longitude: -117.8205717 },
  { id: '162', name: 'College of Business Administration (South)', code: 'BLDG 162', latitude: 34.06133431966068, longitude: -117.81952513245147 },
  { id: '163', name: 'College of Business Administration',         code: 'BLDG 163', latitude: 34.06134191246987, longitude: -117.82042625877310 },
  { id: '164', name: 'College of Business Administration (North)', code: 'BLDG 164', latitude: 34.0615797, longitude: -117.8198195 },
  { id: '209',  name: 'Building 209',                              code: 'BLDG 209',  latitude: 34.049679, longitude: -117.824142 },
  { id: '209b', name: 'Building 209B',                             code: 'BLDG 209B', latitude: 34.049679, longitude: -117.824142 },
  { id: '209B', name: 'Building 209B',                             code: 'BLDG 209B', latitude: 34.049679, longitude: -117.824142 },
  { id: '209s', name: 'Building 209S',                             code: 'BLDG 209S', latitude: 34.049679, longitude: -117.824142 },
]).onConflictDoUpdate({
  target: buildings.id,
  set: {
    name:      sql`excluded.name`,
    code:      sql`excluded.code`,
    latitude:  sql`excluded.latitude`,
    longitude: sql`excluded.longitude`,
  },
});

// Only insert rooms if they don't already exist.
await db.insert(rooms).values([
  // Engineering (9)
  { id: '9-101', buildingId: '9', number: '9-101', type: 'Lecture Hall', capacity: 120 },
  { id: '9-201', buildingId: '9', number: '9-201', type: 'Computer Lab',  capacity: 40  },
  { id: '9-110', buildingId: '9', number: '9-110', type: 'Seminar Room',  capacity: 20  },
  { id: '9-301', buildingId: '9', number: '9-301', type: 'Study Room',    capacity: 8   },
  { id: '9-210', buildingId: '9', number: '9-210', type: 'Lab A',         capacity: 35  },
  // Library (15)
  { id: 'l-1',     buildingId: '15', number: 'L-1',     type: 'Main Floor',   capacity: 200 },
  { id: 'l-101',   buildingId: '15', number: 'L-101',   type: 'Study Room A', capacity: 6   },
  { id: 'l-102',   buildingId: '15', number: 'L-102',   type: 'Study Room B', capacity: 6   },
  { id: 'l-201',   buildingId: '15', number: 'L-201',   type: 'Quiet Zone',   capacity: 40  },
  { id: 'l-group', buildingId: '15', number: 'L-Group', type: 'Group Room',   capacity: 8   },
  // Business (163)
  { id: '163-101', buildingId: '163', number: '163-101', type: 'Lecture Hall', capacity: 80 },
  { id: '163-102', buildingId: '163', number: '163-102', type: 'Lecture Hall', capacity: 60 },
  { id: '163-201', buildingId: '163', number: '163-201', type: 'Seminar',      capacity: 25 },
  { id: '163-210', buildingId: '163', number: '163-210', type: 'Conference',   capacity: 12 },
  { id: '163-301', buildingId: '163', number: '163-301', type: 'Computer Lab', capacity: 30 },
  // Science (8)
  { id: '8-101', buildingId: '8', number: '8-101', type: 'Chem Lab',     capacity: 30  },
  { id: '8-102', buildingId: '8', number: '8-102', type: 'Bio Lab',      capacity: 30  },
  { id: '8-201', buildingId: '8', number: '8-201', type: 'Lecture Hall', capacity: 100 },
  { id: '8-301', buildingId: '8', number: '8-301', type: 'Study Lounge', capacity: 20  },
  { id: '8-110', buildingId: '8', number: '8-110', type: 'Conference',   capacity: 12  },
]).onConflictDoNothing();

console.log('Seeded buildings and rooms');
process.exit(0);
