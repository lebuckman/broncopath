import type { RoutingGraphEdge } from "./types";

export function routeToLineString(edges: RoutingGraphEdge[]) {
  const coordinates: [number, number][] = [];

  for (const edge of edges) {
    for (const point of edge.geometry) {
      const last = coordinates[coordinates.length - 1];

      if (!last || last[0] !== point[0] || last[1] !== point[1]) {
        coordinates.push(point);
      }
    }
  }

  return {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
    properties: {},
  };
}