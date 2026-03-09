# BroncoPath — Backend Engineering Reference

> This document is the complete technical handoff for the BroncoPath backend.
> Read this entire file before writing any code. It covers the project context,
> stack, database schema, API contracts, scraper design, and build order.
> The mobile app is already built against these exact contracts using mock data —
> your job is to make them real.

---

## What Is BroncoPath?

A mobile app for Cal Poly Pomona students that predicts building and classroom
occupancy using CPP's publicly available class schedule data. Students can:

- See which buildings are busy right now
- Find available classrooms and study rooms
- Get crowd-avoiding walking routes across campus

**The core insight:** CPP publishes its full class schedule at `schedule.cpp.edu`.
If we know which rooms have classes at any given time, we can calculate how busy
each building is — no sensors, no hardware, no real-time data needed.

---

## Your Role

The mobile frontend (React Native + Expo) is complete and running with mock data.
Your job is to build the backend that makes it real:

1. **Python scraper** — pulls CPP's class schedule into the database
2. **Neon PostgreSQL database** — stores buildings, rooms, and schedule data
3. **Express REST API** — serves occupancy predictions to the mobile app

Once your API is live, the mobile developer will swap the base URL in `.env`
and the app will be running on real data.

---

## Tech Stack

| Layer       | Technology                                      |
| ----------- | ----------------------------------------------- |
| Runtime     | Node.js 18+                                     |
| Framework   | Express (TypeScript)                            |
| Database    | Neon (serverless PostgreSQL)                    |
| ORM         | Drizzle ORM                                     |
| Scraper     | Python 3.11+ with Playwright + BeautifulSoup    |
| Data Source | schedule.cpp.edu (primary) + alternatives below |
| Deployment  | Railway or Render (free tier)                   |

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                  # Express server entry point
│   ├── routes/
│   │   ├── buildings.ts          # GET /api/buildings
│   │   ├── rooms.ts              # GET /api/buildings/:id/rooms
│   │   ├── routes.ts             # GET /api/routes
│   │   └── health.ts             # GET /api/health
│   ├── db/
│   │   ├── index.ts              # Neon connection + Drizzle instance
│   │   └── schema.ts             # Drizzle table definitions
│   ├── services/
│   │   ├── occupancy.ts          # Busyness score calculation logic
│   │   └── routing.ts            # Dijkstra route scoring logic
│   └── lib/
│       └── campus-graph.ts       # CPP walkway graph definition
├── scraper/
│   ├── scrape.py                 # Main scraper entry point
│   ├── parse.py                  # Schedule data parser
│   └── seed.py                   # Database seeder
├── .env                          # Never commit this
├── .env.example                  # Commit this with placeholder values
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

---

## Environment Variables

```bash
# .env — never commit this file
DATABASE_URL=your_neon_connection_string_here
PORT=3000
```

> **CORS:** Add the `cors` npm package (`npm install cors`) and enable it in
> `index.ts` — React Native doesn't enforce browser CORS, but you'll need it
> when testing endpoints from a browser or Postman, and for any future web client.
> `app.use(cors())` with no options is fine for development.

Provide a `.env.example` with placeholder values. Add `.env` to `.gitignore`
before the first commit.

---

## Database Schema

Define these tables in `src/db/schema.ts` using Drizzle ORM.

```ts
import {
  pgTable,
  text,
  integer,
  real,
  uuid,
  timestamp,
} from "drizzle-orm/pg-core";

// ── Buildings ─────────────────────────────────────────────────────────
export const buildings = pgTable("buildings", {
  id: text("id").primaryKey(), // e.g. 'eng-9'
  name: text("name").notNull(), // 'Engineering Building'
  code: text("code").notNull(), // 'BLDG 9'
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
});

// ── Rooms ─────────────────────────────────────────────────────────────
export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(), // e.g. '9-101'
  buildingId: text("building_id")
    .notNull()
    .references(() => buildings.id),
  number: text("number").notNull(), // '9-101'
  type: text("type").notNull(), // 'Lecture Hall'
  capacity: integer("capacity").notNull(),
});

// ── Schedule entries (scraped from schedule.cpp.edu) ──────────────────
export const scheduleEntries = pgTable("schedule_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id),
  buildingId: text("building_id")
    .notNull()
    .references(() => buildings.id),
  dayOfWeek: text("day_of_week").notNull(), // 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI'
  startTime: text("start_time").notNull(), // '09:00' (24hr format)
  endTime: text("end_time").notNull(), // '10:15'
  courseName: text("course_name"),
  semester: text("semester").notNull(), // 'Spring 2026'
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## API Contracts

These are the exact response shapes the mobile app expects.
Do not change field names or types — the frontend is already typed against these.

### `GET /api/health`

Simple uptime check. Used for monitoring.

```json
{
  "status": "ok",
  "timestamp": "2026-03-01T10:00:00.000Z"
}
```

---

### `GET /api/buildings`

Returns all buildings with **current** occupancy scores based on time of request.

```ts
// Response: BuildingResponse[]
interface BuildingResponse {
  id: string;
  name: string;
  code: string;
  occupancy: number; // 0–100 integer
  level: "low" | "med" | "high";
  roomCount: number; // total rooms in building
  freeCount: number; // rooms with no active class right now
  latitude: number;
  longitude: number;
  updatedAt: string; // ISO timestamp of last scrape
}
```

**Occupancy calculation:**

```
occupancy = (rooms with active class at current time / total rooms) × 100

level classification:
  0–39%   → 'low'
  40–69%  → 'med'
  70–100% → 'high'
```

"Active class at current time" = any schedule entry where:

- `dayOfWeek` matches today
- `startTime` ≤ current time ≤ `endTime`

---

### `GET /api/buildings/:id/rooms`

Returns all rooms in a building with current availability status.

```ts
// Response: RoomResponse[]
interface RoomResponse {
  id: string;
  number: string;
  type: string;
  capacity: number;
  status: "free" | "busy" | "soon";
  freesAt?: string; // '10:00 AM' — only present when status === 'soon'
}
```

**Status logic:**

```
busy → room has an active class right now
soon → room has an active class ending within the next 15 minutes
free → no active class right now
```

> **Note on `freesAt` format:** The database stores times in 24hr format (`'13:00'`),
> but the API must return `freesAt` in 12hr AM/PM format (`'1:00 PM'`) to match the
> mobile app contract. Convert in the API layer before returning.

---

### `GET /api/routes?from=:buildingId&to=:buildingId`

Returns ranked route options between two buildings.

```ts
interface RouteStep {
  instruction: string; // 'Head north along the main walkway'
}

interface RouteOption {
  id: string;
  type: "recommended" | "fastest";
  title: string; // 'Least Crowded Path' | 'Shortest Path'
  walkMinutes: number;
  distanceM: number;
  crowdLevel: "low" | "med" | "high";
  steps: RouteStep[];
  crowdTip?: string; // 'Clears up around 10:15 AM'
}

// Response: RouteOption[]  (always 2 items — recommended first, fastest second)
```

---

## Occupancy Service

Implement this in `src/services/occupancy.ts`. This is the core logic.

```ts
// Given a buildingId and a Date, return the occupancy score
export async function getBuildingOccupancy(
  buildingId: string,
  at: Date = new Date(),
): Promise<{
  occupancy: number;
  level: "low" | "med" | "high";
  freeCount: number;
  roomCount: number;
}> {
  const dayOfWeek = getDayOfWeek(at); // 'MON' | 'TUE' etc.
  const timeStr = getTimeString(at); // '09:30' (24hr)

  // 1. Count total rooms in building
  // 2. Count rooms with active schedule entry at dayOfWeek + timeStr
  // 3. occupancy = (active / total) * 100
  // 4. Classify level
  // 5. Return
}
```

---

## Python Scraper

The scraper lives in `scraper/` and is run manually (or on a cron) to refresh data.
It does not need to be part of the Node.js process.

### Data sources

You are not limited to `schedule.cpp.edu`. Investigate these in order of ease:

1. **`schedule.cpp.edu`** — CPP's public schedule search. Requires form submission
   (select term, subject, etc.) before results load, so Playwright is needed to
   drive the interaction. This is the most authoritative source.

2. **CPP 25Live** (`25live.collegenet.com/cpp`) — CPP's room booking system.
   Has a public calendar view per room/building that may be more scraper-friendly
   (structured HTML or JSON calendar events) without requiring form interaction.

3. **`cppscheduler.com`** — A student project that already scrapes the same
   schedule data. Review their open-source approach as a reference for understanding
   the schedule.cpp.edu data structure and any undocumented API endpoints they
   discovered.

Use whichever source yields the cleanest data. The scraper just needs to produce
`(building, room, dayOfWeek, startTime, endTime, semester)` tuples — the source
doesn't matter to the rest of the system. Feel free to investigate other possible data sources.

### What to scrape

Target: `https://schedule.cpp.edu` (or alternative above)

For each course section, extract:

- Building name / code
- Room number
- Days of week (M/T/W/Th/F)
- Start time
- End time
- Course name (optional)
- Semester

### Scraper design

```python
# scraper/scrape.py

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import json

def scrape_schedule():
    """
    1. Launch headless browser via Playwright
    2. Navigate to schedule.cpp.edu
    3. Query for all sections (may require form submission or pagination)
    4. Parse HTML with BeautifulSoup
    5. Return list of ScheduleEntry dicts
    """
    pass

def parse_days(day_string: str) -> list[str]:
    """
    Convert CPP day format to standard day codes.
    e.g. 'MWF' → ['MON', 'WED', 'FRI']
         'TTh' → ['TUE', 'THU']
    """
    pass

def parse_time(time_string: str) -> str:
    """
    Convert CPP time format to 24hr HH:MM string.
    e.g. '9:00AM' → '09:00'
         '1:15PM' → '13:15'
    """
    pass
```

```python
# scraper/seed.py

import psycopg2
import os
from scrape import scrape_schedule

def seed_database(entries):
    """
    1. Connect to Neon via DATABASE_URL env var
    2. Upsert buildings (insert if not exists)
    3. Upsert rooms
    4. Delete existing schedule entries for current semester
    5. Insert all new schedule entries
    """
    pass

if __name__ == '__main__':
    entries = scrape_schedule()
    seed_database(entries)
    print(f'Seeded {len(entries)} schedule entries')
```

---

## Routing Service

Implement in `src/services/routing.ts` and `src/lib/campus-graph.ts`.

### Campus Graph

Define the CPP walkway network as a graph of nodes and edges.
Plot ~30–40 nodes along major walkways using Google Maps satellite view.

```ts
// src/lib/campus-graph.ts

export interface GraphNode {
  id: string;
  label?: string; // 'Engineering North Entrance'
  latitude: number;
  longitude: number;
}

export interface GraphEdge {
  from: string; // node id
  to: string; // node id
  distanceM: number; // physical walking distance
  instruction: string; // 'Head north along the main walkway'
  nearBuilding?: string; // building id — used for crowd penalty
}

export const CAMPUS_NODES: GraphNode[] = [
  {
    id: "n1",
    label: "Building 9 North Entrance",
    latitude: 34.0582,
    longitude: -117.8218,
  },
  {
    id: "n2",
    label: "Central Walkway North",
    latitude: 34.0575,
    longitude: -117.821,
  },
  {
    id: "n3",
    label: "Library West Entrance",
    latitude: 34.0569,
    longitude: -117.8205,
  },
  // ... add ~30 more nodes
];

export const CAMPUS_EDGES: GraphEdge[] = [
  {
    from: "n1",
    to: "n2",
    distanceM: 80,
    instruction: "Head south along the main walkway",
    nearBuilding: "eng-9",
  },
  {
    from: "n2",
    to: "n3",
    distanceM: 60,
    instruction: "Continue south toward the library",
    nearBuilding: "lib-15",
  },
  // ... edges are bidirectional — add both directions
];
```

### Dijkstra Implementation

```ts
// src/services/routing.ts

export function findRoute(
  fromBuildingId: string,
  toBuildingId: string,
  mode: "fastest" | "recommended",
  occupancyMap: Record<string, number>, // buildingId → occupancy 0–100
): RouteOption {
  // 1. Find graph nodes closest to from/to building entrances
  // 2. For each edge, calculate weight:
  //    fastest:     weight = distanceM
  //    recommended: weight = distanceM × crowdPenalty(nearBuilding occupancy)
  // 3. Run Dijkstra from source node to destination node
  // 4. Collect path nodes + edge instructions
  // 5. Sum distance and estimate walk time (avg 80m/min walking speed)
  // 6. Determine overall crowdLevel from buildings along path
  // 7. Return RouteOption
}

function crowdPenalty(occupancy: number): number {
  if (occupancy >= 70) return 2.0; // heavily penalize busy paths
  if (occupancy >= 40) return 1.4; // moderate penalty
  return 1.0; // no penalty for quiet areas
}
```

---

## Build Order

Build in this exact sequence. One commit per step.

```
Step 1:  Init Express + TypeScript project, health endpoint working
Step 2:  Connect to Neon — test connection, confirm DATABASE_URL works
Step 3:  Drizzle schema — buildings, rooms, schedule_entries tables
Step 4:  Run drizzle-kit push to create tables in Neon
Step 5:  Manually seed 4–5 buildings and ~5 rooms each (hardcoded seed script)
Step 6:  GET /api/buildings endpoint — returns buildings with static occupancy
Step 7:  Occupancy service — calculate live scores from schedule_entries
Step 8:  Wire occupancy service into GET /api/buildings
Step 9:  GET /api/buildings/:id/rooms with live status logic
Step 10: Python scraper — connect to schedule.cpp.edu, parse data
Step 11: Python seeder — write parsed data to Neon
Step 12: Run scraper → verify real CPP data appears in /api/buildings
Step 13: Campus graph — define nodes and edges for CPP walkways
Step 14: Dijkstra routing service — fastest + recommended routes
Step 15: GET /api/routes endpoint wired to routing service
Step 16: Deploy to Railway or Render — share live URL with mobile developer
```

---

## Commit Convention

```
feat(api): add health endpoint
feat(db): add drizzle schema for buildings and rooms
feat(db): add manual seed script with CPP buildings
feat(api): add buildings endpoint with static occupancy
feat(occupancy): implement busyness score calculation
feat(scraper): parse schedule.cpp.edu course sections
feat(routing): implement dijkstra with crowd penalty weighting
feat(api): add routes endpoint
fix(occupancy): correct time comparison for edge cases
chore: configure drizzle-kit and database connection
```

---

## Deployment (Railway — Recommended)

1. Push backend to GitHub (same repo under `/backend` or separate repo)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add environment variable: `DATABASE_URL` from your Neon dashboard
4. Railway auto-detects Node.js and deploys on every push to `main`
5. Share the generated Railway URL with the mobile developer
6. Mobile developer updates `EXPO_PUBLIC_API_BASE_URL` in their `.env`

Neon is already cloud-hosted — no deployment needed for the database.

---

## Testing Your Endpoints

Before handing off to the mobile developer, verify each endpoint manually:

```bash
# Health check
curl http://localhost:3000/api/health

# All buildings with occupancy
curl http://localhost:3000/api/buildings

# Rooms for a specific building
curl http://localhost:3000/api/buildings/eng-9/rooms

# Route between two buildings
curl "http://localhost:3000/api/routes?from=eng-9&to=lib-15"
```

All responses should match the TypeScript interfaces defined above exactly.

---

## CPP Building Reference

Seed these buildings first. Use Google Maps satellite view to find pinpoint-accurate
coordinates for each building entrance. The values below are approximate placeholders —
**replace them with accurate coordinates before seeding.**

Once the backend has confirmed coordinates, share them with the mobile developer
so `constants/mockData.ts` can be updated to match.

| ID        | Name                      | Code     | Latitude | Longitude  |
| --------- | ------------------------- | -------- | -------- | ---------- |
| `eng-9`   | Engineering Building      | BLDG 9   | 34.05886 | -117.82222 |
| `lib-15`  | University Library        | BLDG 15  | 34.05750 | -117.82138 |
| `biz-163` | College of Business       | BLDG 163 | 34.06159 | -117.81964 |
| `sci-8`   | Science Building          | BLDG 8   | 34.05862 | -117.82485 |
| `cla-10`  | College of Letters & Arts | BLDG 10  | TBD      | TBD        |

> `cla-10` is not yet in the mobile mock data — coordinate with the mobile
> developer to add it to both sides at the same time.

---

## Course Info

**CS 4800.02 — Software Engineering**
Cal Poly Pomona · Spring 2026
Methodology: Scrum (2 sprints) · AI-augmented workflow

Frontend reference files: `docs/contexts/DESIGN.md` and `docs/contexts/REQUIREMENTS.md`
