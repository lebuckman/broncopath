# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npx expo start           # Start dev server (Expo Go / QR)
npx expo start --ios     # Open iOS simulator
npx expo start --android # Open Android emulator
npx expo start --clear   # Clear Metro cache — use after any config change
```

No test runner or linter is configured yet.

---

## Architecture

**Entry point:** `index.ts` → `App.tsx` (standard Expo, not Expo Router yet).
The `app/` directory and Expo Router are installed but not yet wired up — `package.json` `main` still points to `index.ts`. Switching to Expo Router requires changing `main` to `"expo-router/entry"`.

**Styling — NativeWind v4:**
- All components use `className` props. Do not mix `StyleSheet.create` and `className` in the same component; use `StyleSheet` only for values NativeWind cannot express (`shadowColor`, `elevation`).
- `global.css` holds the Tailwind directives and must be imported once at the root entry file.
- `tailwindcss` must stay on **v3** — NativeWind v4.2.x throws explicitly on Tailwind v4.
- `react-native-worklets` and `react-native-reanimated` are required at runtime because `nativewind/babel` → `react-native-css-interop/babel` unconditionally injects `react-native-worklets/plugin` and the CSS interop runtime imports Reanimated.

**Design system:**
`docs/contexts/DESIGN.md` is the single source of truth for colors, typography, spacing, component specs, and screen layouts. Read it before writing any component or screen. Never use raw hex strings in components — always import from `constants/colors.ts`.

**Data flow:**
All screens use mock data from `constants/mockData.ts`. The mock shapes exactly match the API contracts in `docs/contexts/REQUIREMENTS.md`, so switching to the live backend only requires changing the data source, not the components.

**Build order:**
Follow the 14-step sequence in `docs/contexts/REQUIREMENTS.md` § Build Order. One commit per step. Do not skip ahead.

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