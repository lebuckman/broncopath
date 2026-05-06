import type { RoutingGraph, RoutingGraphEdge } from "./types";
import type { CongestionMap } from "./congestion";
import { getEdgeCongestionScore } from "./congestion";

type Result = {
  path: RoutingGraphEdge[];
  totalTime: number;
  totalDistance: number;
  congestionPenalty: number;
};

type Options = {
  departureTime: string; // "HH:mm"
  congestionWeight?: number;
};

export function dijkstraLeastCrowded(
  graph: RoutingGraph,
  startId: string,
  endId: string,
  congestion: CongestionMap,
  options: Options,
): Result | null {
  const congestionWeight = options.congestionWeight ?? 90;

  const distances: Record<string, number> = {};
  const previous: Record<string, RoutingGraphEdge | null> = {};
  const visited = new Set<string>();
  const queue: string[] = [];

  for (const nodeId in graph.nodes) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
  }

  distances[startId] = 0;
  queue.push(startId);

  while (queue.length > 0) {
    queue.sort((a, b) => distances[a] - distances[b]);
    const current = queue.shift()!;

    if (current === endId) break;
    if (visited.has(current)) continue;

    visited.add(current);

    for (const edge of graph.adjacency[current] || []) {
      const congestionScore = getEdgeCongestionScore(
        congestion,
        edge.id,
        options.departureTime,
      );

      const cost =
        edge.walkTimeSeconds +
        edge.accessibilityPenalty +
        congestionScore * congestionWeight;

      const newDistance = distances[current] + cost;

      if (newDistance < distances[edge.toNodeId]) {
        distances[edge.toNodeId] = newDistance;
        previous[edge.toNodeId] = edge;
        queue.push(edge.toNodeId);
      }
    }
  }

  if (!previous[endId]) return null;

  const path: RoutingGraphEdge[] = [];
  let current = endId;

  while (current !== startId) {
    const edge = previous[current];
    if (!edge) break;

    path.unshift(edge);
    current = edge.fromNodeId;
  }

  return {
    path,
    totalTime: path.reduce((sum, edge) => sum + edge.walkTimeSeconds, 0),
    totalDistance: path.reduce((sum, edge) => sum + edge.distanceMeters, 0),
    congestionPenalty: distances[endId] - path.reduce((sum, edge) => sum + edge.walkTimeSeconds, 0),
  };
}