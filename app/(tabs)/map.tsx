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
import RoutePlannerSheet from "../../components/map/RoutePlannerSheet";
import FloatingMapSearchBar from "../../components/map/FloatingMapSearchBar";
import BuildingDetailSheet from "../../components/building/BuildingDetailSheet";
import { buildRoutingGraph } from "../../lib/routing/buildGraph";
import { dijkstra } from "../../lib/routing/dijkstra";
import {
  routeToLineString,
  type GeoJSONLine,
} from "../../lib/routing/routeToGeoJSON";
import { findBuildingNode } from "../../lib/routing/findBuildingNode";

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export default function MapScreen() {
  const { recenterMap } = useLocalSearchParams<{ recenterMap?: string }>();
  const cameraRef = useRef<any>(null);

  const { buildings, loading } = useBuildings();
  const { favorites } = useFavorites();
  const { graph, refreshing: graphRefreshing, error: graphError } =
    useCampusGraph();

  const [roomsMap, setRoomsMap] = useState<Record<string, Room[]>>(() => {
    const map: Record<string, Room[]> = {};

    getCachedBuildings().forEach((building) => {
      map[building.id] = getCachedRooms(building.id);
    });

    return map;
  });

  const [selected, setSelected] = useState<Building | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const [startBuilding, setStartBuilding] = useState<Building | null>(null);
  const [endBuilding, setEndBuilding] = useState<Building | null>(null);
  const [routeSheetExpanded, setRouteSheetExpanded] = useState(false);

  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSONLine | null>(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(
    null,
  );
  const [routeWalkTimeSeconds, setRouteWalkTimeSeconds] = useState<
    number | null
  >(null);

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("any");

  const routingGraph = useMemo(() => {
    if (!graph) return null;
    return buildRoutingGraph(graph.nodes, graph.edges);
  }, [graph]);

  useEffect(() => {
    if (!routingGraph || !startBuilding || !endBuilding) {
      setRouteGeoJSON(null);
      setRouteDistanceMeters(null);
      setRouteWalkTimeSeconds(null);
      return;
    }

    const startNode = findBuildingNode(routingGraph, startBuilding.id);
    const endNode = findBuildingNode(routingGraph, endBuilding.id);

    console.log("Routing from/to", {
      startBuilding: startBuilding.id,
      endBuilding: endBuilding.id,
      startNode,
      endNode,
    });

    if (!startNode || !endNode) {
      setRouteGeoJSON(null);
      setRouteDistanceMeters(null);
      setRouteWalkTimeSeconds(null);
      return;
    }

    const result = dijkstra(routingGraph, startNode.id, endNode.id);

    console.log("Route result", result);

    if (!result) {
      setRouteGeoJSON(null);
      setRouteDistanceMeters(null);
      setRouteWalkTimeSeconds(null);
      return;
    }

    setRouteGeoJSON(routeToLineString(result.path));
    setRouteDistanceMeters(result.totalDistance);
    setRouteWalkTimeSeconds(result.totalTime);
  }, [routingGraph, startBuilding, endBuilding]);

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
      setActiveFilters((prev) =>
        prev.filter((filter) => filter !== "Favorites"),
      );
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

  function clearRoute() {
    setStartBuilding(null);
    setEndBuilding(null);
    setRouteGeoJSON(null);
    setRouteDistanceMeters(null);
    setRouteWalkTimeSeconds(null);
  }

  function fitCameraToRoute() {
   const coordinates = routeGeoJSON?.geometry?.coordinates;

    if (!coordinates || coordinates.length === 0) return;

    const lngs = coordinates.map((coord) => coord[0]);
    const lats = coordinates.map((coord) => coord[1]);

    const center: [number, number] = [
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ];

    cameraRef.current?.flyTo(center, 900);
  }

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1"
      style={{ backgroundColor: Colors.bg }}
    >
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
                  duration: 500,
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

              {routeGeoJSON && (
                <MLRN.GeoJSONSource id="routeSource" data={routeGeoJSON}>
                  <MLRN.Layer
                    id="routeLine"
                    type="line"
                    paint={{
                      "line-color": "#4ade80",
                      "line-width": 6,
                      "line-opacity": 0.92,
                    }}
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                  />
                </MLRN.GeoJSONSource>
              )}

              {visibleBuildings.map((building) => {
                const isStart = startBuilding?.id === building.id;
                const isEnd = endBuilding?.id === building.id;

                return (
                  <MLRN.Marker
                    key={building.id}
                    id={`building-${building.id}`}
                    lngLat={[building.longitude, building.latitude]}
                    anchor="center"
                    onPress={() => handleMarkerPress(building)}
                  >
                    <View
                      style={{
                        backgroundColor: isStart
                          ? "#3b82f6"
                          : isEnd
                            ? "#ef4444"
                            : Colors.surface,
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
                );
              })}
            </MLRN.Map>

            <FloatingMapSearchBar
              activeFilters={activeFilters}
              filterMode={filterMode}
              showFavorites={favorites.length > 0}
              onChangeFilters={setActiveFilters}
              onChangeFilterMode={setFilterMode}
              onFocusSearch={() => setRouteSheetExpanded(true)}
            />

            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                top: 88,
                right: 12,
                zIndex: 10,
              }}
            >
              <MapLegend />
            </View>

            <RoutePlannerSheet
              expanded={routeSheetExpanded}
              onExpandedChange={setRouteSheetExpanded}
              buildings={buildings}
              startBuilding={startBuilding}
              endBuilding={endBuilding}
              routeDistanceMeters={routeDistanceMeters}
              routeWalkTimeSeconds={routeWalkTimeSeconds}
              onSelectStart={setStartBuilding}
              onSelectEnd={setEndBuilding}
              onClearRoute={clearRoute}
              onGo={fitCameraToRoute}
            />
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