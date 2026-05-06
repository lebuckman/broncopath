import { useMemo } from "react";
import * as MLRN from "@maplibre/maplibre-react-native";
import { Colors } from "../../constants/colors";
import type { Building } from "../../constants/mockData";

type Props = {
  buildings: Building[];
  onPressBuilding: (building: Building) => void;
};

export default function BuildingMarkersLayer({
  buildings,
  onPressBuilding,
}: Props) {
  const buildingById = useMemo(() => {
    const map = new Map<string, Building>();

    for (const building of buildings) {
      map.set(building.id, building);
    }

    return map;
  }, [buildings]);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: buildings.map((building) => ({
        type: "Feature" as const,
        id: building.id,
        properties: {
          id: building.id,
          code: building.code,
          name: building.name,
          level: building.level,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [building.longitude, building.latitude],
        },
      })),
    }),
    [buildings],
  );

  function handlePress(event: any) {
    const feature =
      event?.features?.[0] ??
      event?.nativeEvent?.features?.[0] ??
      event?.feature;

    const buildingId = String(feature?.properties?.id ?? "");

    if (!buildingId) return;

    const building = buildingById.get(buildingId);

    if (building) {
      onPressBuilding(building);
    }
  }

  return (
    <MLRN.GeoJSONSource
      id="buildingMarkersSource"
      data={geojson}
      onPress={handlePress}
    >
      <MLRN.Layer
        id="buildingDots"
        type="circle"
        paint={{
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            4,
            16,
            6,
            18,
            8,
          ],
          "circle-color": [
            "match",
            ["get", "level"],
            "low",
            Colors.low,
            "med",
            Colors.med,
            "high",
            Colors.high,
            Colors.accent,
          ],
          "circle-stroke-color": [
            "match",
            ["get", "level"],
            "low",
            Colors.lowBg,
            "med",
            Colors.medBg,
            "high",
            Colors.highBg,
            Colors.accentBg,
          ],
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            1,
            17,
            2,
          ],
          "circle-opacity": 0.95,
        }}
      />
    </MLRN.GeoJSONSource>
  );
}