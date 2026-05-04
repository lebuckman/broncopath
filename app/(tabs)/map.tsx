import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as MLRN from "@maplibre/maplibre-react-native";

import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building, Room } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import { useFavorites } from "../../hooks/useFavorites";
import { useCampusGraph } from "../../hooks/useCampusGraph";
import { getRooms } from "../../lib/api";
import { getCachedBuildings, getCachedRooms } from "../../lib/dataCache";
import { applyRoomFilters, type FilterMode } from "../../lib/roomFilters";
import { CPP_REGION } from "../../constants/campus";
import MapLegend from "../../components/map/MapLegend";
import BuildingDetailSheet from "../../components/building/BuildingDetailSheet";
import GroupedChipFilter from "../../components/ui/GroupedChipFilter";
import { buildRoutingGraph } from "../../lib/routing/buildGraph";
import { dijkstra } from "../../lib/routing/dijkstra";
import { routeToLineString } from "../../lib/routing/routeToGeoJSON";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export default function MapScreen() {
  const { recenterMap } = useLocalSearchParams<{ recenterMap?: string }>();
  const cameraRef = useRef<any>(null);

  const { buildings, loading } = useBuildings();
  const { favorites } = useFavorites();
  const {
    graph,
    refreshing: graphRefreshing,
    error: graphError,
  } = useCampusGraph();

  const [roomsMap, setRoomsMap] = useState<Record<string, Room[]>>(() => {
    const map: Record<string, Room[]> = {};

    getCachedBuildings().forEach((building) => {
      map[building.id] = getCachedRooms(building.id);
    });

    return map;
  });

  const [selected, setSelected] = useState<Building | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("any");

  const routingGraph = useMemo(() => {
    if (!graph) return null;
    return buildRoutingGraph(graph.nodes, graph.edges);
  }, [graph]);

  const testRouteGeoJSON = useMemo(() => {
    if (!routingGraph) return null;

    const nodes = Object.values(routingGraph.nodes);

    const start =
      nodes.find((node) => node.id === "building:17") ??
      nodes.find((node) => node.type === "building");

    const end =
      nodes.find((node) => node.id === "building:15") ??
      nodes.filter((node) => node.type === "building")[10];

    if (!start || !end || start.id === end.id) return null;

    const result = dijkstra(routingGraph, start.id, end.id);

    if (!result) {
      console.log("Route test failed", {
        start,
        end,
      });
      return null;
    }

    console.log("Route test", {
      totalDistance: result.totalDistance,
      totalTime: result.totalTime,
      edges: result.path.length,
    });

    return routeToLineString(result.path);
  }, [routingGraph]);

  useEffect(() => {
    if (!graph) return;

    console.log("Campus graph loaded", {
      version: graph.version.id,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      refreshing: graphRefreshing,
      error: graphError,
    });
  }, [graph, graphRefreshing, graphError]);

  useEffect(() => {
    if (!recenterMap) return;

    cameraRef.current?.flyTo({
      center: [CPP_REGION.longitude, CPP_REGION.latitude],
      zoom: 16,
      duration: 500,
    });
  }, [recenterMap]);

  const buildingIds = buildings.map((building) => building.id).join(",");

  useEffect(() => {
    if (!buildingIds) return;

    function fetchAllRooms() {
      buildings.forEach((building) => {
        getRooms(building.id)
          .then((rooms) => {
            setRoomsMap((prev) => ({
              ...prev,
              [building.id]: rooms,
            }));
          })
          .catch(() => {});
      });
    }

    fetchAllRooms();

    const intervalId = setInterval(fetchAllRooms, 60_000);
    return () => clearInterval(intervalId);
  }, [buildingIds, buildings]);

  useEffect(() => {
    if (favorites.length === 0 && activeFilters.includes("Favorites")) {
      setActiveFilters((prev) => prev.filter((filter) => filter !== "Favorites"));
    }
  }, [favorites, activeFilters]);

  const favoriteIds = favorites.map((favorite) => favorite.roomId);

  const visibleBuildings = buildings.filter((building) => {
    if (activeFilters.length === 0) return true;

    const rooms = roomsMap[building.id];
    if (!rooms) return true;

    return rooms.some((room) =>
      applyRoomFilters(room, activeFilters, filterMode, favoriteIds),
    );
  });

  function handleMarkerPress(building: Building) {
    setSelected(building);
    setSheetVisible(true);
  }

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1"
      style={{ backgroundColor: Colors.bg }}
    >
      <View className="px-5 pt-6 pb-4">
        <Text
          className="text-[26px]"
          style={{ color: Colors.text, fontFamily: Fonts.display }}
        >
          Campus Map
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <Text
            className="text-[12px]"
            style={{ color: Colors.muted, fontFamily: Fonts.body }}
          >
            Tap any building to explore
          </Text>

          <View
            style={{
              flexDirection: "row",
              backgroundColor: Colors.surface,
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <Pressable
              onPress={() => setFilterMode("any")}
              style={{
                paddingHorizontal: 7,
                paddingVertical: 4,
                backgroundColor:
                  filterMode === "any" ? Colors.accentBg : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: Fonts.bodyMedium,
                  color: filterMode === "any" ? Colors.accent : Colors.muted,
                }}
              >
                Any
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilterMode("all")}
              style={{
                paddingHorizontal: 7,
                paddingVertical: 4,
                backgroundColor:
                  filterMode === "all" ? Colors.accentBg : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: Fonts.bodyMedium,
                  color: filterMode === "all" ? Colors.accent : Colors.muted,
                }}
              >
                All
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View className="mb-4">
        <GroupedChipFilter
          active={activeFilters}
          onChange={setActiveFilters}
          showFavorites={favorites.length > 0}
        />
      </View>

      <View style={{ flex: 1 }}>
        {loading ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: Colors.bg,
            }}
          >
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text
              style={{
                color: Colors.muted,
                fontFamily: Fonts.body,
                fontSize: 13,
                marginTop: 12,
              }}
            >
              Loading map…
            </Text>
          </View>
        ) : (
          <>
            <MLRN.Map
              style={{ flex: 1 }}
              mapStyle={MAP_STYLE_URL}
              compass={false}
              logo={false}
              attribution={false}
              onDidFinishLoadingStyle={() => {
                console.log("Map style loaded");

                cameraRef.current?.flyTo({
                  center: [CPP_REGION.longitude, CPP_REGION.latitude],
                  zoom: 16,
                  duration: 500
                });
              }}
              onDidFailLoadingMap={(event: any) =>
                console.log("Map failed", event.nativeEvent)
              }
            >
              <MLRN.Camera
                ref={cameraRef}
                initialViewState={{
                  center: [CPP_REGION.longitude, CPP_REGION.latitude],
                  zoom: 16,
                }}

              />

              {testRouteGeoJSON && (
                <MLRN.GeoJSONSource
                  id="testRouteSource"
                  data={testRouteGeoJSON}
                >
                  <MLRN.Layer
                    id="testRouteLine"
                    type="line"
                    paint={{
                      "line-color": "#4ade80",
                      "line-width": 6,
                    }}
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                  />
                </MLRN.GeoJSONSource>
              )}

              {visibleBuildings.map((building) => (
                <MLRN.Marker
                  key={building.id}
                  id={`building-${building.id}`}
                  lngLat={[building.longitude, building.latitude]}
                  anchor="center"
                  onPress={() => handleMarkerPress(building)}
                >
                  <View
                    style={{
                      backgroundColor: Colors.surface,
                      borderColor: Colors.accent,
                      borderWidth: 1,
                      borderRadius: 20,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.text,
                        fontFamily: Fonts.bodySemiBold,
                        fontSize: 11,
                      }}
                    >
                      {building.code}
                    </Text>
                  </View>
                </MLRN.Marker>
              ))}
            </MLRN.Map>

            <MapLegend />
          </>
        )}
      </View>

      <BuildingDetailSheet
        building={selected}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        activeFilters={activeFilters}
      />
    </SafeAreaView>
  );
}