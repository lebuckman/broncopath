import { RoutingGraph } from "./types";

export function findBuildingNode(graph: RoutingGraph, buildingId: string) {
  return Object.values(graph.nodes).find(
    (node) =>
      node.type === "building" &&
      node.osmNodeId === `building:${buildingId}`,
  );
}