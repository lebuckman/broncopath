import "dotenv/config";

const CPP_RELATION_ID = 11352841;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

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

async function syncOsm() {
  console.log("Fetching CPP OSM data from Overpass...");

  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "BroncoPath/1.0 OSM sync",
    },
    body: `data=${encodeURIComponent(CPP_OVERPASS_QUERY)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass failed with status ${response.status}`);
  }

  const osm = await response.json();

  console.log("Fetched OSM data.");
  console.log("Element count:", osm.elements?.length ?? 0);

  // Later steps:
  // 1. Convert OSM to graph nodes/edges
  // 2. Insert into Neon
  // 3. Mark graph version active
}

syncOsm()
  .then(() => {
    console.log("OSM sync completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("OSM sync failed:", error);
    process.exit(1);
  });