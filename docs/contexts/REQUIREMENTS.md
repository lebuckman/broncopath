# BroncoPath — Engineering Requirements

> Condensed technical reference for Claude Code. Full requirements are in the
> formal Requirements Specification document. This file covers what to build,
> what quality bar to hit, and what the data contracts look like.
> Read DESIGN.md alongside this file before writing any code.

---

## What Is BroncoPath?

A React Native mobile app for Cal Poly Pomona (CPP) students that:
1. Predicts building and classroom occupancy from scraped CPP schedule data
2. Shows which rooms are free right now
3. Recommends walking routes that avoid crowded areas

**The core insight:** CPP publishes its class schedule publicly at `schedule.cpp.edu`.
If we know which rooms have classes at any given time, we can infer how busy each
building is — no sensors, no IoT, no hardware required.

---

## Tech Stack

| Layer         | Technology                                      |
|---------------|-------------------------------------------------|
| Mobile        | React Native + Expo SDK + Expo Router v4        |
| Styling       | NativeWind v4 (Tailwind CSS for React Native)   |
| Maps          | react-native-maps + Google Maps SDK             |
| State         | React Context + TanStack Query v5               |
| Backend       | Node.js + Express (teammate's lane)             |
| Database      | Neon (serverless PostgreSQL) + Drizzle ORM      |
| Scraper       | Python + Playwright + BeautifulSoup             |
| Data Source   | schedule.cpp.edu (public, updated nightly)      |

---

## Functional Requirements Summary

### FR-1 · Dashboard
- **FR-1.1** Show occupancy level (Low/Moderate/High) for each building on open
- **FR-1.2** Show numeric occupancy percentage (0–100%) per building
- **FR-1.3** All data reflects current local time + day of week
- **FR-1.4** Show timestamp of last data refresh
- **FR-1.5** Quick-action buttons to Find a Room and Plan a Route

### FR-2 · Campus Map
- **FR-2.1** Render interactive Google Map centered on CPP campus
- **FR-2.2** Building markers color-coded: green (Low) / yellow (Mod) / red (High)
- **FR-2.3** Tap building marker → open detail sheet with rooms
- **FR-2.4** Filter chips: All / Quiet / Moderate / Busy
- **FR-2.5** Show user's GPS location if permission granted

### FR-3 · Crowd Prediction Engine (Backend — not mobile)
- **FR-3.1** Python scraper pulls schedule data from schedule.cpp.edu
- **FR-3.2** Busyness score = (rooms with active class / total rooms) × 100
- **FR-3.3** Scores stored in Neon DB, served via Express REST API
- **FR-3.4** Scraper re-runs each semester; supports manual re-trigger
- **FR-3.5** Classification: Low = 0–39%, Moderate = 40–69%, High = 70–100%

### FR-4 · Room Availability
- **FR-4.1** Select building → list all rooms with status (Free / In Use)
- **FR-4.2** Each room shows: number, type, seat capacity
- **FR-4.3** "In Use" rooms show time when they next become free
- **FR-4.4** Filter to show only Free rooms
- **FR-4.5** Faculty/staff use same interface (no separate role needed)

### FR-5 · Route Planning
- **FR-5.1** User inputs start building + destination building
- **FR-5.2** Returns ≥ 2 routes: crowd-avoiding (recommended) + shortest
- **FR-5.3** Each route shows crowd level along the path
- **FR-5.4** Each route shows estimated walk time (min) + distance (m)
- **FR-5.5** Crowd tip: when does the busy route clear up?
- **FR-5.6** User can select preferred route (highlighted state)

---

## Non-Functional Requirements (Acceptance Criteria)

These are the quality gates Claude Code should keep in mind when writing code.

| ID       | Category        | Requirement                                   | Pass Condition                                      |
|----------|-----------------|-----------------------------------------------|-----------------------------------------------------|
| NFR-1.1  | Performance     | App launch ≤ 3s to interactive dashboard      | Cold launch on 3GB RAM device, 9/10 runs pass       |
| NFR-1.2  | Performance     | API response ≤ 500ms for any endpoint         | 20 consecutive requests, no concurrent load         |
| NFR-1.3  | Performance     | Map renders markers ≤ 2s                      | 5 consecutive navigations to map tab                |
| NFR-2.1  | Reliability     | API uptime ≥ 95% during demo period           | 7-day rolling window monitoring                     |
| NFR-2.2  | Reliability     | Graceful error if API unreachable             | App shows error state, does not crash               |
| NFR-2.3  | Reliability     | Consistent data across all 3 screens          | Same building shows same level everywhere           |
| NFR-3.1  | Usability       | New user reaches Find a Room in < 60s         | 3-user test, no instruction                         |
| NFR-3.2  | Usability       | All features reachable in ≤ 2 taps            | From any screen, verified by inspection             |
| NFR-3.3  | Usability       | Density indicators include text labels        | No color-only indicators anywhere                   |
| NFR-4.1  | Scalability     | API handles 50 concurrent requests ≤ 1s each | Artillery load test, 95% pass rate                  |
| NFR-5.1  | Security        | No PII stored on device                       | Zero AsyncStorage writes with user data             |
| NFR-5.2  | Security        | No API keys in source code or git history     | grep + git log audit before demo                    |
| NFR-5.3  | Security        | HTTPS only for all API calls                  | Network inspection via Flipper                      |
| NFR-6.2  | Maintainability | README setup in ≤ 30 min on clean machine     | Blind setup test passes                             |
| NFR-7.1  | Portability     | Runs on iOS 16+ and Android 12+               | Smoke test on iOS sim + Android emulator            |

---

## API Contract (Mobile ↔ Backend)

> These are the agreed data shapes. The mobile app should be built against these
> interfaces from day 1 using mock data. When the backend is ready, only the
> data source changes — not the components.

### `GET /api/buildings`
Returns all buildings with current occupancy scores.

```ts
interface BuildingResponse {
  id:         string;
  name:       string;
  code:       string;
  occupancy:  number;        // 0–100
  level:      'low' | 'med' | 'high';
  roomCount:  number;
  freeCount:  number;
  latitude:   number;
  longitude:  number;
  updatedAt:  string;        // ISO timestamp
}

// Response: BuildingResponse[]
```

### `GET /api/buildings/:id/rooms`
Returns all rooms in a building with current availability.

```ts
interface RoomResponse {
  id:        string;
  number:    string;        // e.g. '9-101'
  type:      string;        // 'Lecture Hall' | 'Computer Lab' | 'Seminar' | 'Study Room' | 'Lab'
  capacity:  number;
  status:    'free' | 'busy' | 'soon';
  freesAt?:  string;        // '10:00 AM' — only present when status === 'soon'
}

// Response: RoomResponse[]
```

### `GET /api/routes?from=:buildingId&to=:buildingId`
Returns ranked route options between two buildings.

```ts
interface RouteStep {
  instruction: string;       // e.g. 'Head north on central walkway'
}

interface RouteOption {
  id:          string;
  type:        'recommended' | 'fastest';
  title:       string;
  walkMinutes: number;
  distanceM:   number;
  crowdLevel:  'low' | 'med' | 'high';
  steps:       RouteStep[];
  crowdTip?:   string;       // e.g. 'Clears up around 10:15 AM'
}

// Response: RouteOption[]
```

### `GET /api/health`
Simple health check. Returns `{ status: 'ok', timestamp: string }`.

---

## Folder Structure

```
broncopath/
├── app/
│   ├── _layout.tsx              # Root layout — loads fonts, sets theme
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigator config
│   │   ├── index.tsx            # Home / Dashboard
│   │   ├── map.tsx              # Campus Map
│   │   ├── rooms.tsx            # Find a Room
│   │   └── route.tsx            # Route Planner
├── components/
│   ├── ui/                      # Primitive components (no business logic)
│   │   ├── DensityDot.tsx
│   │   ├── DensityBar.tsx
│   │   ├── RoomBadge.tsx
│   │   ├── SectionLabel.tsx
│   │   ├── NowPill.tsx
│   │   ├── ChipFilter.tsx
│   │   └── BottomSheet.tsx
│   ├── building/
│   │   ├── BuildingCard.tsx
│   │   ├── BuildingAccordion.tsx
│   │   └── BuildingDetailSheet.tsx
│   ├── map/
│   │   ├── BuildingMarker.tsx
│   │   └── MapLegend.tsx
│   └── route/
│       ├── RouteInputCard.tsx
│       ├── RouteOptionCard.tsx
│       └── CrowdTipCard.tsx
├── constants/
│   ├── colors.ts                # All color tokens (see DESIGN.md)
│   ├── fonts.ts                 # Font family references
│   ├── mockData.ts              # All mock buildings/rooms/routes
│   ├── mapStyle.ts              # Google Maps dark style JSON
│   └── campus.ts                # CPP map region, building coords
├── hooks/
│   ├── useBuildings.ts          # Fetches /api/buildings (mock → real)
│   ├── useRooms.ts              # Fetches /api/buildings/:id/rooms
│   └── useRoutes.ts             # Fetches /api/routes
├── lib/
│   └── api.ts                   # Axios/fetch wrapper with base URL config
└── assets/
    └── fonts/                   # Local font files if not using Google Fonts
```

---

## Build Order (Sprint 1)

Claude Code should build in this exact sequence. Do not skip ahead.

```
Step 1:  NativeWind + Tailwind config verified working (test with a colored View)
Step 2:  Root _layout.tsx — fonts loaded, dark background, StatusBar
Step 3:  Tab navigator — 4 tabs, correct icons, active/inactive colors
Step 4:  constants/colors.ts + constants/mockData.ts
Step 5:  Primitive UI components (DensityDot, DensityBar, RoomBadge, SectionLabel)
Step 6:  BuildingCard component
Step 7:  Home screen — fully built with mock data
Step 8:  BuildingDetailSheet (bottom sheet modal)
Step 9:  Rooms screen — BuildingAccordion with mock data
Step 10: Route screen — RouteOptionCard with mock data
Step 11: Map screen — MapView with BuildingMarker components
Step 12: ChipFilter wired to map and rooms screens
Step 13: lib/api.ts — fetch wrapper pointed at mock/localhost
Step 14: useBuildings, useRooms, useRoutes hooks (using mock data)
```

Each step = one commit. Commit message format: `feat(scope): description`

---

## Commit Convention

```
feat(ui): add DensityDot and DensityBar components
feat(home): build dashboard screen with mock building data
feat(map): add MapView with dark style and building markers
feat(rooms): add BuildingAccordion with room availability list
feat(route): add route option cards with crowd level display
feat(api): add fetch wrapper with base URL configuration
fix(map): correct marker color mapping for med density level
style(home): adjust card spacing and section label weight
chore: update tailwind config with custom color tokens
```

---

## Environment Variables

Never hardcode these. Use `.env` and `expo-constants` or `react-native-dotenv`.

```
# .env (never commit this file)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

Access in code:
```ts
import Constants from 'expo-constants';
const API_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
```

Add `.env` to `.gitignore` immediately. Provide `.env.example` with placeholder values.

---

## Out of Scope for MVP

Do not build these unless explicitly instructed:
- User authentication or login
- Push notifications
- Saved/favourite routes or rooms
- Historical crowd trend graphs
- Real-time sensor or WiFi-based occupancy
- Dark/light mode toggle
- Onboarding tutorial flow
- Accessibility (screen reader) support beyond color labels