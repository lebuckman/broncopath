import { RoutingGraph } from "./types";

export function findBuildingNode(
  graph: RoutingGraph,
  buildingId: string,
  lat?: number,
  lng?: number,
) {
  const exact = Object.values(graph.nodes).find(
    (node) =>
      node.type === "building" &&
      node.osmNodeId === `building:${buildingId}`,
  );
  if (exact) return exact;

  if (lat == null || lng == null) return null;

  let nearest = null;
  let minDist = Infinity;
  for (const node of Object.values(graph.nodes)) {
    const dLat = node.lat - lat;
    const dLng = node.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }
  return nearest;
}