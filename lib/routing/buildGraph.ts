import { RoutingGraph, RoutingGraphNode, RoutingGraphEdge } from "./types";

export function buildRoutingGraph(nodes: any[], edges: any[]) {
  const nodeMap: Record<string, any> = {};
  const adjacency: Record<string, any[]> = {};

  for (const rawNode of nodes) {
    const node = {
      id: rawNode.id,
      graphVersionId: rawNode.graphVersionId ?? rawNode.graph_version_id,
      osmNodeId: rawNode.osmNodeId ?? rawNode.osm_node_id,
      lat: rawNode.lat,
      lng: rawNode.lng,
      type: rawNode.type,
      label: rawNode.label,
    };

    nodeMap[node.id] = node;
    adjacency[node.id] = [];
  }

  for (const rawEdge of edges) {
    const edge = {
      id: rawEdge.id,
      graphVersionId: rawEdge.graphVersionId ?? rawEdge.graph_version_id,
      fromNodeId: rawEdge.fromNodeId ?? rawEdge.from_node_id,
      toNodeId: rawEdge.toNodeId ?? rawEdge.to_node_id,
      distanceMeters: rawEdge.distanceMeters ?? rawEdge.distance_meters,
      walkTimeSeconds: rawEdge.walkTimeSeconds ?? rawEdge.walk_time_seconds,
      highwayType: rawEdge.highwayType ?? rawEdge.highway_type,
      surface: rawEdge.surface,
      incline: rawEdge.incline,
      isStairs: rawEdge.isStairs ?? rawEdge.is_stairs,
      accessibilityPenalty:
        rawEdge.accessibilityPenalty ?? rawEdge.accessibility_penalty ?? 0,
      geometry: rawEdge.geometry,
    };

    if (!adjacency[edge.fromNodeId]) {
      adjacency[edge.fromNodeId] = [];
    }

    adjacency[edge.fromNodeId].push(edge);
  }

  return {
    nodes: nodeMap,
    adjacency,
  };
}