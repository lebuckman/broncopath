# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run ios              # expo run:ios  — full native build (required for SDK 55)
npm run android          # expo run:android
npx expo start --clear   # Clear Metro cache — use after any config change
```

`expo run:ios` (not `expo start --ios`) is required because SDK 55 is not supported by the pre-built Expo Go binary. Any time new native packages are installed, the native binary must be rebuilt with `expo run:ios`.

No test runner or linter is configured yet.

---

## Architecture

**Entry point:** `expo-router/entry` → `app/_layout.tsx` (root layout) → `app/(tabs)/_layout.tsx` (tab navigator) → individual tab screens.

**Styling — NativeWind v4:**
- All components use `className` props. Do not mix `StyleSheet.create` and `className` in the same component; use `StyleSheet` only for values NativeWind cannot express (`shadowColor`, `elevation`).
- `global.css` holds the Tailwind directives and must be imported once at the root entry file.
- `tailwindcss` must stay on **v3** — NativeWind v4.2.x throws explicitly on Tailwind v4.
- `react-native-worklets` and `react-native-reanimated` are required at runtime because `nativewind/babel` → `react-native-css-interop/babel` unconditionally injects `react-native-worklets/plugin` and the CSS interop runtime imports Reanimated.

**Design system:**
`docs/contexts/DESIGN.md` is the single source of truth for colors, typography, spacing, component specs, and screen layouts. Read it before writing any component or screen. Never use raw hex strings in components — always import from `constants/colors.ts`.

**Data flow:**
Screens fetch live data from the Express backend (`backend/`) via `lib/api.ts`. On launch, `LoadingScreen` calls `prefetchBuildings()` + `prefetchRooms()` from `lib/dataCache.ts`, populating a module-level singleton cache. `useBuildings` and `useRooms` read from this cache synchronously at `useState` init time, eliminating skeleton flashes on first tab navigation. Both hooks continue 60s polling independently — the cache is seed-only and never updated by polling. `constants/mockData.ts` defines the shared TypeScript types but is no longer the data source.

**Build order — current progress:**
Sprint 1 complete (Steps 1–14). Sprint 2 complete.

**Sprint 1:**
- ✅ Step 1: NativeWind configured and verified
- ✅ Step 2: Root `_layout.tsx` — fonts, dark bg, StatusBar, Expo Router entry
- ✅ Step 3: Tab navigator — Feather icons, active/inactive colors (3 tabs on main: Home/Map/Rooms; 4 tabs on feat/library adding Library)
- ✅ Step 4: `constants/colors.ts` + `constants/mockData.ts`
- ✅ Step 5: `DensityDot`, `DensityBar`, `RoomBadge`, `SectionLabel` primitives
- ✅ Step 6: `BuildingCard` component (`components/building/`)
- ✅ Step 7: Home screen — greeting, NowPill, BuildingCard list, Quick Actions grid
- ✅ Step 8: `BuildingDetailSheet` — slide-up modal with room list (wired to Home)
- ✅ Step 9: Rooms screen — `BuildingAccordion` with LayoutAnimation expand/collapse
- ✅ Step 10: Route screen built as standalone tab (later removed — route planning moved into Map tab)
- ✅ Step 11: Map screen — MapLibre (`@maplibre/maplibre-react-native`) + `BuildingMarker` + `MapLegend` + `BuildingDetailSheet` on tap
- ✅ Step 12: Chip filters wired to Map and Rooms screens
- ✅ Step 13: `lib/api.ts` — live fetch wrapper pointed at Express backend
- ✅ Step 14: `useBuildings`, `useRooms`, `useRoutes` hooks — `useState`/`useEffect`, 60s polling

**Sprint 2:**
- ✅ `useFavorites` — module-level shared state with AsyncStorage persistence; `FavoriteButton` component
- ✅ Room favorites — favorites filter chip, favorites float to top in `BuildingDetailSheet`
- ✅ `lib/dataCache.ts` — module-level seed cache; `prefetchBuildings` + `prefetchRooms`
- ✅ `components/LoadingScreen.tsx` — branded launch screen; prefetches all data before tab mount
- ✅ Pull-to-refresh on Rooms screen (`useBuildings` exposes `refresh()`)
- ✅ Double-tap Rooms tab — collapses all accordions and scrolls to top
- ✅ `GroupedChipFilter` — replaces flat chip row; dropdowns via `Modal` + `measureInWindow`
- ✅ `roomFilters.ts` — Availability / Type / Seats filter groups; Busy + capacity tier filters
- ✅ Performance: `useMemo` on `filteredBuildings`, stable rooms polling dep, type cast fixes
- ✅ Route Planner — `FloatingMapSearchBar` + `RoutePlannerSheet` integrated into Map tab; route tab removed
- ✅ Dijkstra routing — client-side shortest + least-crowded route computation over OSM campus graph
- ✅ `useCampusGraph` — fetches graph with version-check caching (`refreshCampusGraphCacheIfNeeded`)
- ✅ `useCongestion` — stubbed (returns null); congestion precomputation deferred to backend
- ✅ `useUserLocation` — GPS tracking via `expo-location` + MapLibre `LocationManager`; auto-reroute at 18m deviation
- ✅ Library tab (`app/(tabs)/library.tsx`) — CPP LibCal room booking via WebView SSO handoff (`feat/library` branch)

**Known patterns:**
- `Pressable` + NativeWind: use `useState` + `onPressIn`/`onPressOut` with a static `style` object — do NOT use the function-style `style={({ pressed }) => ...}` form, which NativeWind v4 silently drops.
- `SafeAreaView` on tab screens: always pass `edges={['top']}` — the tab navigator already handles the bottom safe area, and omitting `edges` causes a double inset gap above the tab bar.
- Dynamic colors (from `Colors.*`) and `fontFamily` go in the `style` prop; layout/spacing go in `className`. Never mix `StyleSheet.create` with `className` in the same component.
- **MapLibre** (`@maplibre/maplibre-react-native`) replaced `react-native-maps`. MapLibre's `MapView` also requires explicit pixel dimensions — use `onLayout` to measure the container, then pass `{ width: '100%', height: measuredHeight }`. No API key required; dark mode style is set via `mapStyle` prop using a custom style JSON (`constants/mapStyle.ts`).
- `app.config.js` replaces `app.json` for config (Expo prioritises it when both exist). Declares `@maplibre/maplibre-react-native` and `expo-router` as plugins. Any new native package with an Expo config plugin must be added here, followed by `pod install` + `npm run ios` to rebuild.
- **Adding a native package**: install via npm → add to `app.config.js` plugins if required → run `cd ios && pod install` → run `npm run ios`. Skipping `pod install` leaves the native module out of the binary and causes `TurboModuleRegistry` errors at runtime.
- **Module-level seed cache** (`lib/dataCache.ts`): `prefetchBuildings()` + `prefetchRooms()` are called once by `LoadingScreen` at launch. Hooks read from `getCachedBuildings()` / `getCachedRooms()` synchronously in lazy `useState` initializers. The cache is never written by polling — it is seed-only.
- **`useFavorites`**: module-level `globalFavorites` array + `Set<() => void>` subscribers. Every hook instance registers a `forceUpdate` subscriber on mount and removes it on unmount. `toggleFavorite` calls `persistAndNotify`, which mutates `globalFavorites`, writes to AsyncStorage, and notifies all subscribers. Never store a local copy of favorites — always read from `globalFavorites`.
- **Dropdowns above native views** (`GroupedChipFilter`): use `Modal transparent` + `ref.measureInWindow()` to position a floating panel above `MapView` and other native layers — the same pattern as `BottomSheet`. Wrap the panel in a no-op `Pressable` to absorb touches and prevent the full-screen backdrop `Pressable` from closing the modal when the user taps inside the panel.
- **`useBuildings` `refresh()`**: returns a `Promise` that re-fetches buildings and updates state. Used by pull-to-refresh in the Rooms screen — call it alongside per-building `getRooms()` inside `Promise.all`, then `setRefreshing(false)` in `.finally()`.

---

## Key Config Files

| File | Purpose |
|------|---------|
| `app.config.js` | Expo app config — replaces `app.json`; declares `@maplibre/maplibre-react-native` + `expo-router` plugins |
| `babel.config.js` | `babel-preset-expo` with `jsxImportSource: 'nativewind'` + `nativewind/babel` preset |
| `metro.config.js` | Wraps default Expo config with `withNativeWind({ input: './global.css' })` |
| `tailwind.config.js` | Content paths for `app/`, `components/`, `App.tsx`; includes `nativewind/preset` |
| `nativewind-env.d.ts` | `/// <reference types="nativewind/types" />` — adds `className` prop to RN component types |

---

## Commit Convention

```
feat(scope): description    # new feature or screen
fix(scope): description     # bug fix
style(scope): description   # UI/styling, no logic change
refactor(scope): description
chore: description          # config, deps, tooling
docs: description
```

---

## Environment Variables

`.env` and `.env.local` are gitignored. Copy `.env.example` to `.env.local`.

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```