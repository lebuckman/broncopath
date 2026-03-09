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
All screens use mock data from `constants/mockData.ts`. The mock shapes exactly match the API contracts in `docs/contexts/REQUIREMENTS.md`, so switching to the live backend only requires changing the data source, not the components.

**Build order — current progress:**
All 14 steps complete. Sprint 1 done.
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
- ✅ Step 12: `ChipFilter` wired to Map (OR logic) and Rooms (AND logic + empty state) screens
- ✅ Step 13: `lib/api.ts` — fetch wrapper; mock returns today, uncomment fetch for live backend
- ✅ Step 14: `useBuildings`, `useRooms`, `useRoutes` hooks — `useState`/`useEffect`, return `{ data, loading, error }`

One commit per step. Do not skip ahead.

**Known patterns:**
- `Pressable` + NativeWind: use `useState` + `onPressIn`/`onPressOut` with a static `style` object — do NOT use the function-style `style={({ pressed }) => ...}` form, which NativeWind v4 silently drops.
- `SafeAreaView` on tab screens: always pass `edges={['top']}` — the tab navigator already handles the bottom safe area, and omitting `edges` causes a double inset gap above the tab bar.
- Dynamic colors (from `Colors.*`) and `fontFamily` go in the `style` prop; layout/spacing go in `className`. Never mix `StyleSheet.create` with `className` in the same component.
- `MapView` (react-native-maps) requires explicit pixel dimensions — `flex: 1` alone does not propagate to native views reliably. Use `onLayout` on the container View to measure actual height, then pass `{ width: '100%', height: measuredHeight }` to MapView.
- Map provider: using `PROVIDER_DEFAULT` (Apple Maps) — no API key needed. Dark mode is handled automatically by `userInterfaceStyle: 'dark'` in `app.config.js`. `customMapStyle` only works with `PROVIDER_GOOGLE` and is not used.
- `app.config.js` replaces `app.json` for config (Expo prioritises it when both exist). Used for `react-native-maps` plugin declaration and any future env-var-driven config.

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