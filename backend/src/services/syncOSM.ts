import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  buildings,
  campusGraphEdges,
  campusGraphNodes,
  campusGraphVersions,
} from "../db/schema.ts";

const CPP_RELATION_ID = 11352841;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const WALKING_SPEED_MPS = 1.35;

const CPP_OVERPASS_QUERY = `
[out:json][timeout:60];

rel(${CPP_RELATION_ID});
map_to_area -> .campus;

(
  way["highway"~"footway|path|pedestrian|steps"](area.campus);
  way["highway"="service"]["access"!~"private|no"](area.campus);
  way["building"](area.campus);
);

out body;
>;
out skel qt;
`;

type OsmNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
};

type OsmWay = {
  type: "way";
  id: number;
  nodes?: number[];
  tags?: Record<string, string>;
};

type OsmElement = OsmNode | OsmWay | Record<string, unknown>;

type Coord = {
  lat: number;
  lng: number;
};

type DbBuilding = {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
};

async function fetchOverpass() {
  console.log("Fetching OSM data from Overpass...");

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "BroncoPath/1.0 OSM campus graph sync",
    },
    body: `data=${encodeURIComponent(CPP_OVERPASS_QUERY)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass failed with status ${response.status}`);
  }

  return response.json();
}

function isOsmNode(element: OsmElement): element is OsmNode {
  return element.type === "node";
}

function isOsmWay(element: OsmElement): element is OsmWay {
  return element.type === "way";
}

function extractBuildingNumber(name?: string | null): string | null {
  if (!name) return null;

  if (name.toLowerCase() === "building one") {
    return "1";
  }

  const match =
    name.match(/\bBuilding\s+([0-9]+[A-Za-z]?)\b/i) ??
    name.match(/^([0-9]+[A-Za-z]?)$/i);

  return match?.[1]?.toUpperCase() ?? null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wayCoords(way: OsmWay, nodesById: Map<number, OsmNode>): Coord[] {
  return (way.nodes ?? [])
    .map((nodeId) => nodesById.get(nodeId))
    .filter((node): node is OsmNode => Boolean(node))
    .map((node) => ({
      lat: node.lat,
      lng: node.lon,
    }));
}

function centroid(coords: Coord[]): Coord | null {
  if (coords.length === 0) return null;

  let lat = 0;
  let lng = 0;

  for (const coord of coords) {
    lat += coord.lat;
    lng += coord.lng;
  }

  return {
    lat: lat / coords.length,
    lng: lng / coords.length,
  };
}

function haversineMeters(a: Coord, b: Coord) {
  const radius = 6371000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.sqrt(h));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function findBuildingWay(
  building: DbBuilding,
  buildingWays: OsmWay[],
  nodesById: Map<number, OsmNode>,
): OsmWay | null {
  const buildingId = building.id.toUpperCase();

  const exactNumberMatches = buildingWays.filter((way) => {
    const name = way.tags?.name;
    return extractBuildingNumber(name) === buildingId;
  });

  if (exactNumberMatches.length === 1) {
    return exactNumberMatches[0];
  }

  if (exactNumberMatches.length > 1) {
    return exactNumberMatches.sort((a, b) => {
      const aName = a.tags?.name ?? "";
      const bName = b.tags?.name ?? "";

      const aExact = normalizeText(aName).startsWith(
        normalizeText(`Building ${buildingId} `),
      );
      const bExact = normalizeText(bName).startsWith(
        normalizeText(`Building ${buildingId} `),
      );

      return Number(bExact) - Number(aExact);
    })[0];
  }

  if (building.id === "1") {
    return (
      buildingWays.find(
        (way) => normalizeText(way.tags?.name ?? "") === "building one",
      ) ?? null
    );
  }

  if (building.id === "15") {
    return (
      buildingWays.find((way) =>
        normalizeText(way.tags?.description ?? "").includes("old library"),
      ) ?? null
    );
  }

  if (building.id === "209") {
    const lyleWays = buildingWays.filter((way) =>
      normalizeText(way.tags?.name ?? "").includes("lyle center"),
    );

    if (lyleWays.length === 0) return null;

    return lyleWays.sort((a, b) => {
      const aAreaScore = wayCoords(a, nodesById).length;
      const bAreaScore = wayCoords(b, nodesById).length;
      return bAreaScore - aAreaScore;
    })[0];
  }

  const buildingName = normalizeText(building.name);

  if (buildingName.length >= 5) {
    const nameMatch = buildingWays.find((way) => {
      const osmName = normalizeText(way.tags?.name ?? "");
      return osmName.includes(buildingName) || buildingName.includes(osmName);
    });

    if (nameMatch) return nameMatch;
  }

  return null;
}

function cleanBuildingName(name: string, buildingId: string) {
  return name
    .replace(new RegExp(`^Building\\s+${buildingId}\\s*-\\s*`, "i"), "")
    .replace(/^Building\s+[0-9A-Za-z]+\s*-\s*/i, "")
    .trim();
}

async function main() {
  const osm = await fetchOverpass();

  const elements = (osm.elements ?? []) as OsmElement[];

  const nodesById = new Map<number, OsmNode>();
  const pathWays: OsmWay[] = [];
  const buildingWays: OsmWay[] = [];

  for (const element of elements) {
    if (isOsmNode(element)) {
      nodesById.set(element.id, element);
    }

    if (isOsmWay(element)) {
      if (element.tags?.building) {
        buildingWays.push(element);
      }

      if (element.tags?.highway) {
        pathWays.push(element);
      }
    }
  }

  console.log(`OSM nodes: ${nodesById.size}`);
  console.log(`OSM path ways: ${pathWays.length}`);
  console.log(`OSM building ways: ${buildingWays.length}`);

  const dbBuildings = (await db.select().from(buildings)) as DbBuilding[];

  let updatedBuildingCount = 0;
  const updatedBuildingIds = new Set<string>();

  for (const building of dbBuildings) {
    const matchedWay = findBuildingWay(building, buildingWays, nodesById);

    if (!matchedWay) {
      console.log(`No confident OSM match for ${building.id} ${building.name}`);
      continue;
    }

    const coords = wayCoords(matchedWay, nodesById);
    const center = centroid(coords);

    if (!center) {
      console.log(`No centroid for ${building.id} ${building.name}`);
      continue;
    }

    await db
      .update(buildings)
      .set({
        latitude: center.lat,
        longitude: center.lng,
      })
      .where(eq(buildings.id, building.id));

    updatedBuildingCount += 1;
    updatedBuildingIds.add(building.id);

    console.log(
      `Updated building ${building.id}: ${building.name} -> ${center.lat}, ${center.lng}`,
    );
  }

  const existingIds = new Set(dbBuildings.map((b) => b.id.toUpperCase()));
  const seenOsmBuildingIds = new Set<string>();

  let createdCount = 0;

  for (const way of buildingWays) {
    const name = way.tags?.name ?? null;
    const ref = extractBuildingNumber(name);

    if (!ref) continue;
    if (!name || name.length < 3) continue;

    const buildingId = ref.toUpperCase();

    if (existingIds.has(buildingId)) continue;
    if (seenOsmBuildingIds.has(buildingId)) continue;
    if (!/building/i.test(name)) continue;

    seenOsmBuildingIds.add(buildingId);

    const coords = wayCoords(way, nodesById);
    const center = centroid(coords);

    if (!center) continue;

    const cleanName = cleanBuildingName(name, buildingId);

    const inserted = await db
      .insert(buildings)
      .values({
        id: buildingId,
        name: cleanName || name,
        code: `BLDG ${buildingId}`,
        latitude: center.lat,
        longitude: center.lng,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      existingIds.add(buildingId);
      createdCount += 1;
      console.log(`Created building ${buildingId}: ${cleanName || name}`);
    }
  }

  console.log(`Created missing buildings from OSM: ${createdCount}`);

  console.log(`Created missing buildings from OSM: ${createdCount}`);

  const [graphVersion] = await db
    .insert(campusGraphVersions)
    .values({
      campusId: "cpp",
      source: "openstreetmap",
      osmRelationId: String(CPP_RELATION_ID),
      status: "pending",
    })
    .returning();

  const usedPathNodeIds = new Set<number>();

  for (const way of pathWays) {
    for (const nodeId of way.nodes ?? []) {
      if (nodesById.has(nodeId)) {
        usedPathNodeIds.add(nodeId);
      }
    }
  }

  const pathNodeRows = [...usedPathNodeIds].map((osmNodeId) => {
    const node = nodesById.get(osmNodeId)!;

    return {
      graphVersionId: graphVersion.id,
      osmNodeId: String(osmNodeId),
      lat: node.lat,
      lng: node.lon,
      type: "path_node",
      label: null,
    };
  });

  const osmNodeIdToDbNodeId = new Map<number, string>();

  for (const batch of chunk(pathNodeRows, 500)) {
    const inserted = await db
      .insert(campusGraphNodes)
      .values(batch)
      .returning();

    for (const node of inserted) {
      osmNodeIdToDbNodeId.set(Number(node.osmNodeId), node.id);
    }
  }

  console.log(`Inserted path nodes: ${pathNodeRows.length}`);

  const edgeRows: (typeof campusGraphEdges.$inferInsert)[] = [];

  for (const way of pathWays) {
    const nodeIds = way.nodes ?? [];
    const highwayType = way.tags?.highway ?? null;
    const isStairs = highwayType === "steps";

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const fromOsmId = nodeIds[i];
      const toOsmId = nodeIds[i + 1];

      const fromNode = nodesById.get(fromOsmId);
      const toNode = nodesById.get(toOsmId);

      const fromDbId = osmNodeIdToDbNodeId.get(fromOsmId);
      const toDbId = osmNodeIdToDbNodeId.get(toOsmId);

      if (!fromNode || !toNode || !fromDbId || !toDbId) continue;

      const fromCoord = { lat: fromNode.lat, lng: fromNode.lon };
      const toCoord = { lat: toNode.lat, lng: toNode.lon };
      const distanceMeters = haversineMeters(fromCoord, toCoord);
      const walkTimeSeconds = Math.max(
        1,
        Math.round(distanceMeters / WALKING_SPEED_MPS),
      );

      const baseEdge = {
        graphVersionId: graphVersion.id,
        distanceMeters,
        walkTimeSeconds,
        highwayType,
        surface: way.tags?.surface ?? null,
        incline: way.tags?.incline ?? null,
        isStairs,
        accessibilityPenalty: isStairs ? 999999 : 0,
      };

      edgeRows.push({
        ...baseEdge,
        fromNodeId: fromDbId,
        toNodeId: toDbId,
        geometry: [
          [fromNode.lon, fromNode.lat],
          [toNode.lon, toNode.lat],
        ],
      });

      if (way.tags?.oneway !== "yes") {
        edgeRows.push({
          ...baseEdge,
          fromNodeId: toDbId,
          toNodeId: fromDbId,
          geometry: [
            [toNode.lon, toNode.lat],
            [fromNode.lon, fromNode.lat],
          ],
        });
      }
    }
  }

  for (const batch of chunk(edgeRows, 500)) {
    await db.insert(campusGraphEdges).values(batch);
  }

  console.log(`Inserted path edges: ${edgeRows.length}`);

  const refreshedBuildings = (await db
    .select()
    .from(buildings)) as DbBuilding[];

  const buildingNodeRows = refreshedBuildings.map((building) => ({
    graphVersionId: graphVersion.id,
    osmNodeId: `building:${building.id}`,
    lat: building.latitude,
    lng: building.longitude,
    type: "building",
    label: building.name,
  }));

  const buildingIdToDbNodeId = new Map<string, string>();

  for (const batch of chunk(buildingNodeRows, 500)) {
    const inserted = await db
      .insert(campusGraphNodes)
      .values(batch)
      .returning();

    for (const node of inserted) {
      const buildingId = node.osmNodeId.replace("building:", "");
      buildingIdToDbNodeId.set(buildingId, node.id);
    }
  }

  const pathNodes = [...usedPathNodeIds]
    .map((osmNodeId) => {
      const node = nodesById.get(osmNodeId);
      const dbNodeId = osmNodeIdToDbNodeId.get(osmNodeId);

      if (!node || !dbNodeId) return null;

      return {
        dbNodeId,
        coord: {
          lat: node.lat,
          lng: node.lon,
        },
      };
    })
    .filter(
      (
        value,
      ): value is {
        dbNodeId: string;
        coord: Coord;
      } => Boolean(value),
    );

  const connectorRows: (typeof campusGraphEdges.$inferInsert)[] = [];

  for (const building of refreshedBuildings) {
    const buildingDbNodeId = buildingIdToDbNodeId.get(building.id);
    if (!buildingDbNodeId) continue;

    const buildingCoord = {
      lat: building.latitude,
      lng: building.longitude,
    };

    let nearest: {
      dbNodeId: string;
      coord: Coord;
      distanceMeters: number;
    } | null = null;

    for (const pathNode of pathNodes) {
      const distanceMeters = haversineMeters(buildingCoord, pathNode.coord);

      if (!nearest || distanceMeters < nearest.distanceMeters) {
        nearest = {
          dbNodeId: pathNode.dbNodeId,
          coord: pathNode.coord,
          distanceMeters,
        };
      }
    }

    if (!nearest) continue;

    const walkTimeSeconds = Math.max(
      1,
      Math.round(nearest.distanceMeters / WALKING_SPEED_MPS),
    );

    const baseConnector = {
      graphVersionId: graphVersion.id,
      distanceMeters: nearest.distanceMeters,
      walkTimeSeconds,
      highwayType: "building_connector",
      surface: null,
      incline: null,
      isStairs: false,
      accessibilityPenalty: 0,
    };

    connectorRows.push({
      ...baseConnector,
      fromNodeId: buildingDbNodeId,
      toNodeId: nearest.dbNodeId,
      geometry: [
        [building.longitude, building.latitude],
        [nearest.coord.lng, nearest.coord.lat],
      ],
    });

    connectorRows.push({
      ...baseConnector,
      fromNodeId: nearest.dbNodeId,
      toNodeId: buildingDbNodeId,
      geometry: [
        [nearest.coord.lng, nearest.coord.lat],
        [building.longitude, building.latitude],
      ],
    });
  }

  for (const batch of chunk(connectorRows, 500)) {
    await db.insert(campusGraphEdges).values(batch);
  }

  console.log(`Inserted building connector edges: ${connectorRows.length}`);

  await db
    .update(campusGraphVersions)
    .set({
      status: "archived",
    })
    .where(eq(campusGraphVersions.status, "active"));

  await db
    .update(campusGraphVersions)
    .set({
      status: "active",
      activatedAt: new Date(),
    })
    .where(eq(campusGraphVersions.id, graphVersion.id));

  console.log("Graph version activated.");
  console.log(`Buildings updated from OSM: ${updatedBuildingCount}`);
  console.log(
    `Buildings not updated: ${
      refreshedBuildings.length - updatedBuildingIds.size
    }`,
  );
}

main()
  .then(() => {
    console.log("OSM sync completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("OSM sync failed:", error);
    process.exit(1);
  });
