# BroncoPath — Design System Reference

> This document is the single source of truth for all UI decisions in the BroncoPath
> React Native app. Claude Code should read this before writing any component or screen.
> Do not deviate from these tokens, patterns, or conventions without explicit instruction.

---

## Project Identity

**App Name:** BroncoPath  
**Platform:** React Native + Expo SDK (Expo Router v4)  
**Styling:** NativeWind v4 (Tailwind CSS for React Native)  
**Target:** iOS 16+ and Android 12+  
**Theme:** Dark only — no light mode  

---

## Color Tokens

Define these in `constants/colors.ts` and import throughout the app.
Never use raw hex strings in components — always reference these tokens.

```ts
export const Colors = {
  // Backgrounds
  bg:       '#0d1117',   // page/screen background
  surface:  '#161b22',   // elevated surface (modals, sheets)
  card:     '#1c2128',   // card background
  cardHover:'#21262d',   // card pressed/active state

  // Borders
  border:   'rgba(255,255,255,0.07)',
  borderMd: 'rgba(255,255,255,0.12)',

  // Text
  text:     '#e6edf3',   // primary text
  muted:    '#7d8590',   // secondary/label text
  white:    '#ffffff',

  // Density — the core semantic colors of the app
  low:      '#4ade80',   // green  — quiet / free
  lowDim:   '#16a34a',   // dark green
  lowBg:    'rgba(74,222,128,0.10)',
  lowBorder:'rgba(74,222,128,0.20)',

  med:      '#fbbf24',   // yellow — moderate
  medDim:   '#b45309',
  medBg:    'rgba(251,191,36,0.10)',
  medBorder:'rgba(251,191,36,0.20)',

  high:     '#f87171',   // red    — busy
  highDim:  '#b91c1c',
  highBg:   'rgba(248,113,113,0.10)',
  highBorder:'rgba(248,113,113,0.20)',

  // Accent (same as low — green is the brand accent)
  accent:       '#4ade80',
  accentDim:    '#16a34a',
  accentBg:     'rgba(74,222,128,0.08)',
  accentBorder: 'rgba(74,222,128,0.20)',
} as const;
```

---

## Typography

Use **Fraunces** (display/headings) and **Sora** (body/UI).
Load via `expo-google-fonts`. Until fonts load, fall back to `serif` and `sans-serif`.

```ts
// constants/fonts.ts
export const Fonts = {
  display:        'Fraunces_600SemiBold',
  displayItalic:  'Fraunces_400Regular_Italic',
  body:           'Sora_400Regular',
  bodyMedium:     'Sora_500Medium',
  bodySemiBold:   'Sora_600SemiBold',
  bodyLight:      'Sora_300Light',
  mono:           'DMSans_400Regular', // fallback for labels/IDs
} as const;
```

### Type Scale

| Role              | Font          | Size | Weight | Color         |
|-------------------|---------------|------|--------|---------------|
| Screen title      | Fraunces      | 26   | 600    | text          |
| Section header    | Sora          | 12   | 600    | text          |
| Card title        | Sora          | 14   | 500    | text          |
| Body              | Sora          | 14   | 400    | muted         |
| Label / eyebrow   | Sora          | 11   | 400    | muted         |
| Mono tag / ID     | mono          | 11   | 400    | accent/muted  |
| Percentage value  | Sora          | 14   | 600    | density color |
| Status badge      | Sora          | 10   | 600    | density color |

---

## Spacing & Layout

```
Screen horizontal padding:  px-5  (20px)
Card padding:               p-4   (16px)
Card gap (in lists):        gap-2.5
Section gap:                gap-5
Bottom nav height:          84px  (accounts for safe area)
Status bar height:          44px
Border radius — card:       rounded-2xl  (16px)
Border radius — chip:       rounded-full
Border radius — button:     rounded-xl   (12px)
Border radius — badge:      rounded-full
```

---

## Core Components

Define each of these as a reusable component before building screens.

### 1. `DensityDot`
A small glowing circle indicating crowd level.

```tsx
// components/ui/DensityDot.tsx
// Props: level: 'low' | 'med' | 'high' | 'free' | 'occ'
// Renders: 8x8 rounded circle with matching color + subtle shadow
// Usage: next to building names, inside cards, in room rows
```

Color mapping:
- `low` / `free` → `Colors.low`
- `med` → `Colors.med`  
- `high` / `occ` → `Colors.high`

### 2. `DensityBar`
A horizontal fill bar showing occupancy visually.

```tsx
// components/ui/DensityBar.tsx
// Props: percentage: number (0–100), level: 'low' | 'med' | 'high'
// Renders: full-width track (bg: border color) with colored fill
// Height: 4px, fully rounded
```

### 3. `BuildingCard`
The primary list item for showing a building's occupancy.

```tsx
// components/ui/BuildingCard.tsx
// Props: name, code, percentage, level, roomCount, onPress
// Layout:
//   Row 1: building name (left) + percentage (right, colored)
//   Row 2: building code + room count (left)
//   Row 3: DensityDot + DensityBar + status text (LOW/MOD/BUSY)
// Background: Colors.card
// Border: 1px Colors.border
// Border radius: rounded-2xl
// Press state: slightly darker background (Colors.cardHover)
```

### 4. `RoomBadge`
Status badge for room availability.

```tsx
// components/ui/RoomBadge.tsx
// Props: status: 'free' | 'busy' | 'soon', label?: string
// free → background accentBg, text accent, label 'Free'
// busy → background highBg,   text high,   label 'In Use'
// soon → background medBg,    text med,     label 'Frees at X'
// Size: text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider
```

### 5. `SectionLabel`
Uppercase eyebrow label used above content groups.

```tsx
// components/ui/SectionLabel.tsx
// Props: children: string
// Style: text-[11px] uppercase tracking-[0.12em] text-muted font-normal
// Margin: mb-2.5
```

### 6. `NowPill`
The live indicator shown on the dashboard.

```tsx
// components/ui/NowPill.tsx
// A pill with a blinking green dot + "Live predictions · Updated X min ago"
// Background: accentBg, border: accentBorder, text: accent
// Dot animates opacity 1→0.3→1 on a 1.5s loop using Animated API
```

### 7. `BottomSheet`
A slide-up modal used for building detail.

```tsx
// components/ui/BottomSheet.tsx
// Props: visible, onClose, children
// Animates translateY from screen height to 0 on open
// Background: Colors.surface, rounded-t-3xl
// Includes drag handle (40x4px, rounded, Colors.border)
// Overlay: rgba(0,0,0,0.6) with blur behind sheet
```

### 8. `ChipFilter`
Horizontal scrollable filter row used on Map and Rooms screens.

```tsx
// components/ui/ChipFilter.tsx
// Props: options: string[], active: string, onChange: (val) => void
// Active chip: accentBg background, accentBorder, accent text
// Inactive: card background, border, muted text
// Wrapped in horizontal ScrollView with showsHorizontalScrollIndicator={false}
```

---

## Screen Layouts

### Home Screen (`app/(tabs)/index.tsx`)

```
<SafeAreaView bg={Colors.bg}>
  <StatusBar dark />
  
  {/* Greeting */}
  "Good [morning/afternoon], Bronco 👋"  ← muted, 12px
  "What's happening now"                 ← Fraunces, 24px, text color

  {/* NowPill */}
  <NowPill />

  <ScrollView>
    <SectionLabel>Campus Overview</SectionLabel>
    {buildings.map(b => <BuildingCard ... onPress={openModal} />)}

    <SectionLabel>Quick Actions</SectionLabel>
    {/* 2-column grid */}
    <QuickActionCard icon="🚪" label="Find a Room" sub="See what's open now"  color="green" />
    <QuickActionCard icon="🧭" label="Plan a Route" sub="Avoid the crowds"    color="blue"  />
  </ScrollView>
</SafeAreaView>
```

### Map Screen (`app/(tabs)/map.tsx`)

```
<SafeAreaView>
  <ScreenHeader title="Campus Map" sub="Tap any building to explore" />
  <ChipFilter options={['All Buildings','🟢 Quiet','🟡 Moderate','🔴 Busy']} />
  
  {/* Map container — react-native-maps MapView */}
  <MapView
    provider={PROVIDER_GOOGLE}
    initialRegion={CPP_REGION}
    customMapStyle={DARK_MAP_STYLE}  // dark map JSON (see constants/mapStyle.ts)
  >
    {buildings.map(b => <BuildingMarker key={b.id} building={b} onPress={openModal} />)}
  </MapView>
  
  {/* Map legend — absolute positioned bottom-right */}
  <MapLegend />
</SafeAreaView>
```

**CPP Map Region:**
```ts
export const CPP_REGION = {
  latitude:     34.0573,
  longitude:  -117.8210,
  latitudeDelta:  0.008,
  longitudeDelta: 0.008,
};
```

Use a dark `customMapStyle` JSON for the map — Google's "Aubergine" or "Night" preset works well. Store in `constants/mapStyle.ts`.

### Rooms Screen (`app/(tabs)/rooms.tsx`)

```
<SafeAreaView>
  <ScreenHeader title="Find a Room" sub="X rooms available right now" />
  <ChipFilter options={['All','🟢 Free Now','Study Rooms','Labs']} />
  
  <ScrollView>
    {buildings.map(b => (
      <BuildingAccordion
        key={b.id}
        name={b.name}
        freeCount={b.freeCount}
        rooms={b.rooms}
      />
    ))}
  </ScrollView>
</SafeAreaView>
```

`BuildingAccordion` expands/collapses with `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`.

### Route Screen (`app/(tabs)/route.tsx`)

```
<SafeAreaView>
  <ScreenHeader title="Plan a Route" sub="Smart crowd-avoiding navigation" />

  {/* Input card */}
  <RouteInputCard from="CLA Building (10)" to="Engineering Bldg 9" />

  <SectionLabel>Suggested Routes</SectionLabel>

  <ScrollView>
    <RouteOptionCard
      tag="★ Recommended"  tagColor="accent"
      title="Least Crowded Path"
      walkTime="9 min"  crowd="Low"   distance="680m"
      steps={[...]}
      selected={selected === 0}
      onPress={() => setSelected(0)}
    />
    <RouteOptionCard
      tag="⚡ Fastest"  tagColor="blue"
      title="Shortest Path"
      walkTime="6 min"  crowd="High"  distance="440m"
      steps={[...]}
      selected={selected === 1}
      onPress={() => setSelected(1)}
    />

    {/* Crowd tip */}
    <CrowdTipCard message="Science Bldg 8 clears up around 10:15 AM..." />

    <PrimaryButton label="Start Navigation" icon="map" />
  </ScrollView>
</SafeAreaView>
```

---

## Bottom Tab Navigator

```tsx
// app/(tabs)/_layout.tsx
// 4 tabs: Home, Map, Rooms, Routes
// tabBarStyle: {
//   backgroundColor: 'rgba(13,17,23,0.95)',
//   borderTopColor: Colors.border,
//   height: 84,
// }
// active tint:   Colors.accent  (#4ade80)
// inactive tint: Colors.muted   (#7d8590)
// Tab labels: uppercase, 10px, tracking-wider
// Icons: use @expo/vector-icons (Feather set)
//   Home  → 'home'
//   Map   → 'map'
//   Rooms → 'grid'
//   Routes→ 'navigation'
```

---

## Mock Data

Until the backend API is ready, all screens use mock data from `constants/mockData.ts`.
Structure mock data to exactly match the shape the real API will return,
so wiring to the live API later only requires changing the data source, not the components.

```ts
// constants/mockData.ts

export type DensityLevel = 'low' | 'med' | 'high';

export interface Room {
  id: string;
  number: string;
  type: string;           // 'Lecture Hall' | 'Lab' | 'Seminar' | 'Study Room'
  capacity: number;
  status: 'free' | 'busy' | 'soon';
  freesAt?: string;       // e.g. '10:00 AM' — only if status === 'soon'
}

export interface Building {
  id: string;
  name: string;
  code: string;           // e.g. 'BLDG 9'
  occupancy: number;      // 0–100
  level: DensityLevel;
  rooms: Room[];
  latitude: number;
  longitude: number;
}

export const BUILDINGS: Building[] = [
  {
    id: 'eng-9',
    name: 'Engineering Building',
    code: 'BLDG 9',
    occupancy: 88,
    level: 'high',
    latitude: 34.0582,
    longitude: -117.8218,
    rooms: [
      { id: '9-101', number: '9-101', type: 'Lecture Hall',  capacity: 120, status: 'busy' },
      { id: '9-201', number: '9-201', type: 'Computer Lab',  capacity: 40,  status: 'busy' },
      { id: '9-110', number: '9-110', type: 'Seminar Room',  capacity: 20,  status: 'free' },
      { id: '9-301', number: '9-301', type: 'Study Room',    capacity: 8,   status: 'free' },
      { id: '9-210', number: '9-210', type: 'Lab A',         capacity: 35,  status: 'busy' },
    ]
  },
  {
    id: 'lib-15',
    name: 'University Library',
    code: 'BLDG 15',
    occupancy: 62,
    level: 'med',
    latitude: 34.0569,
    longitude: -117.8205,
    rooms: [
      { id: 'l-1',     number: 'L-1',     type: 'Main Floor',    capacity: 200, status: 'busy' },
      { id: 'l-101',   number: 'L-101',   type: 'Study Room A',  capacity: 6,   status: 'free' },
      { id: 'l-102',   number: 'L-102',   type: 'Study Room B',  capacity: 6,   status: 'free' },
      { id: 'l-201',   number: 'L-201',   type: 'Quiet Zone',    capacity: 40,  status: 'free' },
      { id: 'l-group', number: 'L-Group', type: 'Group Room',    capacity: 8,   status: 'soon', freesAt: '10:00 AM' },
    ]
  },
  {
    id: 'biz-163',
    name: 'College of Business',
    code: 'BLDG 163',
    occupancy: 21,
    level: 'low',
    latitude: 34.0565,
    longitude: -117.8195,
    rooms: [
      { id: '163-101', number: '163-101', type: 'Lecture Hall',  capacity: 80,  status: 'free' },
      { id: '163-102', number: '163-102', type: 'Lecture Hall',  capacity: 60,  status: 'free' },
      { id: '163-201', number: '163-201', type: 'Seminar',       capacity: 25,  status: 'free' },
      { id: '163-210', number: '163-210', type: 'Conference',    capacity: 12,  status: 'free' },
      { id: '163-301', number: '163-301', type: 'Computer Lab',  capacity: 30,  status: 'busy' },
    ]
  },
  {
    id: 'sci-8',
    name: 'Science Building',
    code: 'BLDG 8',
    occupancy: 79,
    level: 'high',
    latitude: 34.0578,
    longitude: -117.8200,
    rooms: [
      { id: '8-101', number: '8-101', type: 'Chem Lab',       capacity: 30,  status: 'busy' },
      { id: '8-102', number: '8-102', type: 'Bio Lab',        capacity: 30,  status: 'busy' },
      { id: '8-201', number: '8-201', type: 'Lecture Hall',   capacity: 100, status: 'busy' },
      { id: '8-301', number: '8-301', type: 'Study Lounge',   capacity: 20,  status: 'free' },
      { id: '8-110', number: '8-110', type: 'Conference',     capacity: 12,  status: 'free' },
    ]
  },
];
```

---

## Animation Guidelines

- **Screen transitions:** Expo Router handles these — use default slide
- **Card press:** `scale(0.97)` on `Pressable` via `Animated.spring`
- **Accordion expand:** `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)`
- **BottomSheet open:** `Animated.timing` translateY 300ms ease-out
- **NowPill dot blink:** `Animated.loop` on opacity 1→0.3, duration 750ms each way
- **Density bar fill:** Animate width on mount using `Animated.timing`, 400ms ease-out
- Keep animations subtle — this is a utility app, not a portfolio showcase

---

## Conventions

- All components use `StyleSheet.create` OR NativeWind `className` — pick one per component, do not mix
- Prefer NativeWind `className` for layout, spacing, and color
- Use `StyleSheet.create` only for values NativeWind can't express (e.g. `shadowColor`, `elevation`)
- File naming: `PascalCase` for components, `camelCase` for utilities and hooks
- All screens are functional components with explicit TypeScript types
- No `any` types — define proper interfaces in `constants/types.ts`
- Import order: React → React Native → Expo → third-party → local (enforced by ESLint)