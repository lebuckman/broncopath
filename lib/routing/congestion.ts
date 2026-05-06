import { dijkstra } from "./dijkstra";
import { findBuildingNode } from "./findBuildingNode";
import type { RoutingGraph, RoutingGraphEdge } from "./types";

export type ClassScheduleEntry = {
  id: string;
  roomId: string;
  buildingId: string;
  dayOfWeek: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  enrollment?: number;
};

export type CongestionMap = Record<string, Record<string, number>>;
// edgeId -> timeWindow -> score

export type CongestionOptions = {
  windowMinutes?: number;
  defaultEnrollment?: number;
  edgeCapacity?: number;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToWindow(minutes: number, windowMinutes: number): string {
  const rounded = Math.floor(minutes / windowMinutes) * windowMinutes;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addEdgeUsage(
  congestion: CongestionMap,
  edge: RoutingGraphEdge,
  timeWindow: string,
  count: number,
) {
  congestion[edge.id] ??= {};
  congestion[edge.id][timeWindow] ??= 0;
  congestion[edge.id][timeWindow] += count;
}

export function buildCongestionMap(
  graph: RoutingGraph,
  schedule: ClassScheduleEntry[],
  options: CongestionOptions = {},
): CongestionMap {
  const windowMinutes = options.windowMinutes ?? 5;
  const defaultEnrollment = options.defaultEnrollment ?? 30;
  const edgeCapacity = options.edgeCapacity ?? 80;

  const congestion: CongestionMap = {};

  const byDay = schedule.reduce<Record<string, ClassScheduleEntry[]>>((acc, entry) => {
    acc[entry.dayOfWeek] ??= [];
    acc[entry.dayOfWeek].push(entry);
    return acc;
  }, {});

  for (const dayEntries of Object.values(byDay)) {
    const sorted = [...dayEntries].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
    );

    for (const current of sorted) {
      const currentEnd = timeToMinutes(current.endTime);

      const possibleNextClasses = sorted.filter((next) => {
        const nextStart = timeToMinutes(next.startTime);
        return (
          nextStart > currentEnd &&
          nextStart - currentEnd <= 30 &&
          next.buildingId !== current.buildingId
        );
      });

      for (const next of possibleNextClasses) {
        const fromNode = findBuildingNode(graph, current.buildingId);
        const toNode = findBuildingNode(graph, next.buildingId);

        if (!fromNode || !toNode) continue;

        const route = dijkstra(graph, fromNode.id, toNode.id);
        if (!route) continue;

        const movementCount = Math.min(
          current.enrollment ?? defaultEnrollment,
          next.enrollment ?? defaultEnrollment,
        );

        let elapsedSeconds = 0;

        for (const edge of route.path) {
          const edgeStartMinute = currentEnd + elapsedSeconds / 60;
          const timeWindow = minutesToWindow(edgeStartMinute, windowMinutes);

          addEdgeUsage(
            congestion,
            edge,
            timeWindow,
            movementCount / edgeCapacity,
          );

          elapsedSeconds += edge.walkTimeSeconds;
        }
      }
    }
  }

  return congestion;
}

export function getEdgeCongestionScore(
  congestion: CongestionMap,
  edgeId: string,
  time: string,
  windowMinutes = 5,
): number {
  const timeWindow = minutesToWindow(timeToMinutes(time), windowMinutes);
  return congestion[edgeId]?.[timeWindow] ?? 0;
}

export function getRouteCongestionLevel(
  congestion: CongestionMap,
  path: RoutingGraphEdge[],
  time: string,
): "low" | "med" | "high" {
  if (path.length === 0) return "low";

  const avg =
    path.reduce((sum, edge) => {
      return sum + getEdgeCongestionScore(congestion, edge.id, time);
    }, 0) / path.length;

  if (avg < 0.35) return "low";
  if (avg < 0.75) return "med";
  return "high";
}