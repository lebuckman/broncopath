<div align="center">

<br/>

# 🐴 BroncoPath 🐴

**Crowd-aware campus navigation for Cal Poly Pomona**

_Know your campus. Beat the crowd. Find your space._

<br/>

![Expo](https://img.shields.io/badge/Expo-SDK%2055-000020?style=flat-square&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.83-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-4ade80?style=flat-square&logo=postgresql&logoColor=white)

</div>

## What is BroncoPath?

CPP's existing campus map tells you where buildings are. BroncoPath tells you **how busy they are right now** and **the best route to them**.

BroncoPath is a mobile application that scrapes Cal Poly Pomona's publicly available class schedule data to predict building and classroom occupancy in real time — no sensors, no hardware, no institutional IT contracts required. Students can find a quiet study room, avoid crowded areas between classes, and navigate campus smarter.

This project was created following Agile Methodologies (Scrum) with an AI-augmented workflow under CS4800 Software Engineering at Cal Poly Pomona (Spring 2026). View project deliverables in [`docs/deliverables/`](docs/deliverables/).

| Feature           | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| 📊 Live Dashboard | Building-by-building occupancy overview at the current time |
| 🗺️ Campus Map     | Interactive map with color-coded crowd density markers      |
| 🚪 Room Finder    | Browse available classrooms and study rooms by building     |
| 🧭 Route Planner  | Crowd-avoiding route suggestions between campus buildings   |

## Tech Stack

**Mobile**

- [React Native](https://reactnative.dev/) + [Expo SDK](https://expo.dev/) with [Expo Router v4](https://docs.expo.dev/router/introduction/)
- [NativeWind v4](https://www.nativewind.dev/) — Tailwind CSS for React Native
- [react-native-maps](https://github.com/react-native-maps/react-native-maps) + Google Maps SDK
- [TanStack Query v5](https://tanstack.com/query/latest) — data fetching and caching

**Backend**

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) — REST API
- [Neon](https://neon.tech/) — serverless PostgreSQL
- [Drizzle ORM](https://orm.drizzle.team/) — type-safe database queries

**Data Pipeline**

- Python + Playwright + BeautifulSoup — schedule scraper
- Data source: [schedule.cpp.edu](https://schedule.cpp.edu) (public, updated nightly)

## Getting Started

> [!NOTE]
> Expo Go (the standalone app) currently supports up to SDK 54. Since this project uses Expo SDK 55, development previews are run via the iOS Simulator through Xcode rather than the Expo Go app. 
> 
> Ensure Xcode is installed and up to date before running `npx expo start --ios`.

### Prerequisites

- Node.js 18+
- npm
- Xcode (BroncoPath has only been tested in IOS)
- Expo CLI: `npm install -g expo-cli`

### Installation

```bash
# Clone the repo
git clone https://github.com/lebuckman/broncopath.git
cd broncopath

# Install dependencies
npm install

# Start the development server
npx expo start --ios
```

## Project Structure

```
broncopath/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout
│   └── (tabs)/                 # Tab-based navigation
│       ├── index.tsx           # Home / Dashboard
│       ├── map.tsx             # Campus Map
│       ├── rooms.tsx           # Find a Room
│       └── route.tsx           # Route Planner
├── components/
│   ├── ui/                     # Primitive components
│   ├── building/               # Building-specific components
│   ├── map/                    # Map components
│   └── route/                  # Route components
├── constants/                  # Colors, mock data, types, config
├── hooks/                      # Custom data hooks
├── lib/                        # API fetch wrapper
├── docs/
│   ├── deliverables/           # Agile/Scrum deliverables
│   └── contexts/               # AI context references
│       ├── DESIGN.md           # Visual design system
│       └── REQUIREMENTS.md     # Engineering requirements & API contracts
└── backend/                    # Express API + Drizzle schema (WIP)
    ├── src/
    │   ├── routes/
    │   ├── db/
    │   └── index.ts
    └── scraper/                # Python CPP schedule scraper
```
