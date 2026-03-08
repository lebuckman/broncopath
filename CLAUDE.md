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
Steps 1–3 complete. Next is Step 4.
- ✅ Step 1: NativeWind configured and verified
- ✅ Step 2: Root `_layout.tsx` — fonts, dark bg, StatusBar, Expo Router entry
- ✅ Step 3: Tab navigator — 4 tabs, Feather icons, active/inactive colors
- ⬜ Step 4: `constants/colors.ts` + `constants/mockData.ts`
- ⬜ Step 5: Primitive UI components (DensityDot, DensityBar, RoomBadge, SectionLabel)
- ⬜ Steps 6–14: see `docs/contexts/REQUIREMENTS.md` § Build Order

One commit per step. Do not skip ahead.

---

## Key Config Files

| File | Purpose |
|------|---------|
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

`.env` is gitignored. Copy `.env.example` to `.env`.

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```