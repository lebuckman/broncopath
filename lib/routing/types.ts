export type RoutingGraphNode = {
  id: string;
  osmNodeId?: string | null;
  lat: number;
  lng: number;
  type: string;
  label: string | null;
};

export type RoutingGraphEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  walkTimeSeconds: number;
  geometry: [number, number][];
  isStairs: boolean;
  accessibilityPenalty: number;
};

export type RoutingGraph = {
  nodes: Record<string, RoutingGraphNode>;
  adjacency: Record<string, RoutingGraphEdge[]>;
};