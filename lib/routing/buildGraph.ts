import { RoutingGraph, RoutingGraphNode, RoutingGraphEdge } from "./types";

export function buildRoutingGraph( nodes: RoutingGraphNode[], edges: RoutingGraphEdge[]): RoutingGraph {
  const nodeMap: Record<string, RoutingGraphNode> = {};
  const adjacency: Record<string, RoutingGraphEdge[]> = {};

  for (const node of nodes) {
    nodeMap[node.id] = node;
    adjacency[node.id] = [];
  }

  for (const edge of edges) {
    if (!adjacency[edge.fromNodeId]) continue;
    adjacency[edge.fromNodeId].push(edge);
  }

  return { nodes: nodeMap, adjacency };
}