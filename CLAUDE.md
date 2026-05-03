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
Sprint 1 complete (Steps 1–14). Sprint 2 in progress.

**Sprint 1:**
- ✅ Step 1: NativeWind configured and verified
- ✅ Step 2: Root `_layout.tsx` — fonts, dark bg, StatusBar, Expo Router entry
- ✅ Step 3: Tab navigator — 4 tabs, Feather icons, active/inactive colors
- ✅ Step 4: `constants/colors.ts` + `constants/mockData.ts`
- ✅ Step 5: `DensityDot`, `DensityBar`, `RoomBadge`, `SectionLabel` primitives
- ✅ Step 6: `BuildingCard` component (`components/building/`)
- ✅ Step 7: Home screen — greeting, NowPill, BuildingCard list, Quick Actions grid
- ✅ Step 8: `BuildingDetailSheet` — slide-up modal with room list (wired to Home)
- ✅ Step 9: Rooms screen — `BuildingAccordion` with LayoutAnimation expand/collapse
- ✅ Step 10: Route screen — `RouteInputCard`, `RouteOptionCard`, `CrowdTipCard`
- ✅ Step 11: Map screen — Apple Maps MapView + `BuildingMarker` + `MapLegend` + `BuildingDetailSheet` on tap
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
- 🚧 Route Planner — backend + UI integration in development

**Known patterns:**
- `Pressable` + NativeWind: use `useState` + `onPressIn`/`onPressOut` with a static `style` object — do NOT use the function-style `style={({ pressed }) => ...}` form, which NativeWind v4 silently drops.
- `SafeAreaView` on tab screens: always pass `edges={['top']}` — the tab navigator already handles the bottom safe area, and omitting `edges` causes a double inset gap above the tab bar.
- Dynamic colors (from `Colors.*`) and `fontFamily` go in the `style` prop; layout/spacing go in `className`. Never mix `StyleSheet.create` with `className` in the same component.
- `MapView` (react-native-maps) requires explicit pixel dimensions — `flex: 1` alone does not propagate to native views reliably. Use `onLayout` on the container View to measure actual height, then pass `{ width: '100%', height: measuredHeight }` to MapView.
- Map provider: using `PROVIDER_DEFAULT` (Apple Maps) — no API key needed. Dark mode is handled automatically by `userInterfaceStyle: 'dark'` in `app.config.js`. `customMapStyle` only works with `PROVIDER_GOOGLE` and is not used.
- `app.config.js` replaces `app.json` for config (Expo prioritises it when both exist). Used for `react-native-maps` plugin declaration and any future env-var-driven config.
- **Module-level seed cache** (`lib/dataCache.ts`): `prefetchBuildings()` + `prefetchRooms()` are called once by `LoadingScreen` at launch. Hooks read from `getCachedBuildings()` / `getCachedRooms()` synchronously in lazy `useState` initializers. The cache is never written by polling — it is seed-only.
- **`useFavorites`**: module-level `globalFavorites` array + `Set<() => void>` subscribers. Every hook instance registers a `forceUpdate` subscriber on mount and removes it on unmount. `toggleFavorite` calls `persistAndNotify`, which mutates `globalFavorites`, writes to AsyncStorage, and notifies all subscribers. Never store a local copy of favorites — always read from `globalFavorites`.
- **Dropdowns above native views** (`GroupedChipFilter`): use `Modal transparent` + `ref.measureInWindow()` to position a floating panel above `MapView` and other native layers — the same pattern as `BottomSheet`. Wrap the panel in a no-op `Pressable` to absorb touches and prevent the full-screen backdrop `Pressable` from closing the modal when the user taps inside the panel.
- **`useBuildings` `refresh()`**: returns a `Promise` that re-fetches buildings and updates state. Used by pull-to-refresh in the Rooms screen — call it alongside per-building `getRooms()` inside `Promise.all`, then `setRefreshing(false)` in `.finally()`.

---

## Key Config Files

| File | Purpose |
|------|---------|
| `app.config.js` | Expo app config — replaces `app.json`; declares `react-native-maps` plugin |
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