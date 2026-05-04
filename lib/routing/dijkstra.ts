import { RoutingGraph, RoutingGraphEdge } from "./types";

type Result = {
  path: RoutingGraphEdge[];
  totalTime: number;
  totalDistance: number;
};

export function dijkstra(graph: RoutingGraph, startId: string, endId: string): Result | null {
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
      const cost = edge.walkTimeSeconds;

      const newDist = distances[current] + cost;

      if (newDist < distances[edge.toNodeId]) {
        distances[edge.toNodeId] = newDist;
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

  const totalTime = distances[endId];
  const totalDistance = path.reduce((sum, e) => sum + e.distanceMeters, 0);

  return {
    path,
    totalTime,
    totalDistance,
  };
}
