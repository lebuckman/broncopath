import type {
  RoutingGraph,
  RoutingGraphEdge,
  RoutingGraphNode,
} from "./types";

export const USER_LOCATION_NODE_ID = "user-location";

export type LngLat = [number, number];

export type UserRouteProjection = {
  edge: RoutingGraphEdge;
  projectedPoint: LngLat;
  distanceToEdgeMeters: number;
  distanceFromEdgeStartMeters: number;
  distanceToEdgeEndMeters: number;
  edgeDistanceMeters: number;
};

export type RouteProgress = {
  nearestPoint: LngLat;
  distanceToRouteMeters: number;
  distanceAlongRouteMeters: number;
  routeLengthMeters: number;
  remainingDistanceMeters: number;
  progress: number;
};

const EARTH_RADIUS_METERS = 6371000;

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: LngLat, b: LngLat) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);

  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function lngLatToLocalMeters(point: LngLat, origin: LngLat) {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos(toRad(origin[1]));

  return {
    x: (point[0] - origin[0]) * lngScale,
    y: (point[1] - origin[1]) * latScale,
  };
}

function localMetersToLngLat(
  point: { x: number; y: number },
  origin: LngLat,
): LngLat {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos(toRad(origin[1]));

  return [origin[0] + point.x / lngScale, origin[1] + point.y / latScale];
}

function projectPointToSegment(point: LngLat, a: LngLat, b: LngLat) {
  const origin = point;
  const p = lngLatToLocalMeters(point, origin);
  const av = lngLatToLocalMeters(a, origin);
  const bv = lngLatToLocalMeters(b, origin);

  const ab = {
    x: bv.x - av.x,
    y: bv.y - av.y,
  };

  const ap = {
    x: p.x - av.x,
    y: p.y - av.y,
  };

  const abLengthSquared = ab.x * ab.x + ab.y * ab.y;
  const t =
    abLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / abLengthSquared));

  const projectedLocal = {
    x: av.x + ab.x * t,
    y: av.y + ab.y * t,
  };

  const projectedPoint = localMetersToLngLat(projectedLocal, origin);
  const segmentLengthMeters = distanceMeters(a, b);

  return {
    projectedPoint,
    t,
    distanceToSegmentMeters: distanceMeters(point, projectedPoint),
    distanceFromSegmentStartMeters: segmentLengthMeters * t,
    distanceToSegmentEndMeters: segmentLengthMeters * (1 - t),
    segmentLengthMeters,
  };
}

function edgeGeometry(edge: RoutingGraphEdge): LngLat[] {
  return edge.geometry?.length >= 2 ? edge.geometry : [];
}

export function projectPointToEdge(
  point: LngLat,
  edge: RoutingGraphEdge,
): UserRouteProjection | null {
  const geometry = edgeGeometry(edge);
  if (geometry.length < 2) return null;

  let best:
    | {
        projectedPoint: LngLat;
        distanceToSegmentMeters: number;
        distanceFromEdgeStartMeters: number;
        distanceToEdgeEndMeters: number;
        edgeDistanceMeters: number;
      }
    | null = null;

  let distanceBeforeSegmentMeters = 0;
  let edgeDistanceMeters = 0;

  const segmentLengths: number[] = [];

  for (let i = 0; i < geometry.length - 1; i++) {
    const segmentLength = distanceMeters(geometry[i], geometry[i + 1]);
    segmentLengths.push(segmentLength);
    edgeDistanceMeters += segmentLength;
  }

  for (let i = 0; i < geometry.length - 1; i++) {
    const projection = projectPointToSegment(
      point,
      geometry[i],
      geometry[i + 1],
    );

    const distanceFromEdgeStartMeters =
      distanceBeforeSegmentMeters + projection.distanceFromSegmentStartMeters;

    const candidate = {
      projectedPoint: projection.projectedPoint,
      distanceToSegmentMeters: projection.distanceToSegmentMeters,
      distanceFromEdgeStartMeters,
      distanceToEdgeEndMeters: Math.max(
        0,
        edgeDistanceMeters - distanceFromEdgeStartMeters,
      ),
      edgeDistanceMeters,
    };

    if (
      !best ||
      candidate.distanceToSegmentMeters < best.distanceToSegmentMeters
    ) {
      best = candidate;
    }

    distanceBeforeSegmentMeters += segmentLengths[i];
  }

  if (!best) return null;

  return {
    edge,
    projectedPoint: best.projectedPoint,
    distanceToEdgeMeters: best.distanceToSegmentMeters,
    distanceFromEdgeStartMeters: best.distanceFromEdgeStartMeters,
    distanceToEdgeEndMeters: best.distanceToEdgeEndMeters,
    edgeDistanceMeters: best.edgeDistanceMeters,
  };
}

export function findNearestGraphEdge(
  graph: RoutingGraph,
  point: LngLat,
): UserRouteProjection | null {
  let best: UserRouteProjection | null = null;

  for (const fromNodeId in graph.adjacency) {
    for (const edge of graph.adjacency[fromNodeId] || []) {
      const projection = projectPointToEdge(point, edge);
      if (!projection) continue;

      if (!best || projection.distanceToEdgeMeters < best.distanceToEdgeMeters) {
        best = projection;
      }
    }
  }

  return best;
}

function reverseGeometry(geometry: LngLat[]) {
  return [...geometry].reverse();
}

function makeTempEdge(
  base: RoutingGraphEdge,
  id: string,
  fromNodeId: string,
  toNodeId: string,
  distanceMetersValue: number,
  geometry: LngLat[],
): RoutingGraphEdge {
  const metersPerSecond =
    base.walkTimeSeconds > 0 && base.distanceMeters > 0
      ? base.distanceMeters / base.walkTimeSeconds
      : 1.35;

  return {
    ...base,
    id,
    fromNodeId,
    toNodeId,
    distanceMeters: distanceMetersValue,
    walkTimeSeconds: distanceMetersValue / metersPerSecond,
    geometry,
  };
}

export function buildGraphWithUserLocation(
  graph: RoutingGraph,
  userLngLat: LngLat,
): {
  graph: RoutingGraph;
  projection: UserRouteProjection | null;
} {
  const projection = findNearestGraphEdge(graph, userLngLat);

  if (!projection) {
    return { graph, projection: null };
  }

  const userNode: RoutingGraphNode = {
    id: USER_LOCATION_NODE_ID,
    lat: projection.projectedPoint[1],
    lng: projection.projectedPoint[0],
    type: "user-location",
    label: "Your location",
  };

  const projected = projection.projectedPoint;
  const base = projection.edge;

  const toFromNodeEdge = makeTempEdge(
    base,
    `${USER_LOCATION_NODE_ID}->${base.fromNodeId}`,
    USER_LOCATION_NODE_ID,
    base.fromNodeId,
    projection.distanceFromEdgeStartMeters,
    [projected, ...reverseGeometry(base.geometry).slice(1)],
  );

  const toToNodeEdge = makeTempEdge(
    base,
    `${USER_LOCATION_NODE_ID}->${base.toNodeId}`,
    USER_LOCATION_NODE_ID,
    base.toNodeId,
    projection.distanceToEdgeEndMeters,
    [projected, ...base.geometry.slice(1)],
  );

  return {
    projection,
    graph: {
      nodes: {
        ...graph.nodes,
        [USER_LOCATION_NODE_ID]: userNode,
      },
      adjacency: {
        ...graph.adjacency,
        [USER_LOCATION_NODE_ID]: [toFromNodeEdge, toToNodeEdge],
      },
    },
  };
}

export function getRouteProgress(
  userLngLat: LngLat,
  routeCoordinates: LngLat[],
): RouteProgress | null {
  if (routeCoordinates.length < 2) return null;

  let routeLengthMeters = 0;
  const segmentLengths: number[] = [];

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const length = distanceMeters(routeCoordinates[i], routeCoordinates[i + 1]);
    segmentLengths.push(length);
    routeLengthMeters += length;
  }

  let best:
    | {
        nearestPoint: LngLat;
        distanceToRouteMeters: number;
        distanceAlongRouteMeters: number;
      }
    | null = null;

  let distanceBeforeSegmentMeters = 0;

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const projection = projectPointToSegment(
      userLngLat,
      routeCoordinates[i],
      routeCoordinates[i + 1],
    );

    const distanceAlongRouteMeters =
      distanceBeforeSegmentMeters + projection.distanceFromSegmentStartMeters;

    const candidate = {
      nearestPoint: projection.projectedPoint,
      distanceToRouteMeters: projection.distanceToSegmentMeters,
      distanceAlongRouteMeters,
    };

    if (!best || candidate.distanceToRouteMeters < best.distanceToRouteMeters) {
      best = candidate;
    }

    distanceBeforeSegmentMeters += segmentLengths[i];
  }

  if (!best) return null;

  const remainingDistanceMeters = Math.max(
    0,
    routeLengthMeters - best.distanceAlongRouteMeters,
  );

  return {
    ...best,
    routeLengthMeters,
    remainingDistanceMeters,
    progress:
      routeLengthMeters === 0
        ? 0
        : Math.max(0, Math.min(1, best.distanceAlongRouteMeters / routeLengthMeters)),
  };
}