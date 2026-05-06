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
import { groupBuildings } from "../../lib/buildingGroups";
import type { BuildingSection } from "../../lib/buildingGroups";
import { CPP_REGION } from "../../constants/campus";
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
  const { recenterMap, routeFrom, routeTo, viewBuilding } = useLocalSearchParams<{
    recenterMap?: string;
    routeFrom?: string;
    routeTo?: string;
    viewBuilding?: string;
  }>();
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

  const [startBuilding, setStartBuilding] = useState<Building | null>(null);
  const [endBuilding, setEndBuilding] = useState<Building | null>(null);
  const [routeSheetExpanded, setRouteSheetExpanded] = useState(false);
  const [markersHidden, setMarkersHidden] = useState(false);

  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSONLine | null>(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(
    null,
  );
  const [routeWalkTimeSeconds, setRouteWalkTimeSeconds] = useState<
    number | null
  >(null);

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("any");

  const routeMinutes =
    routeWalkTimeSeconds != null
      ? Math.max(1, Math.round(routeWalkTimeSeconds / 60))
      : null;
  const routeMeters =
    routeDistanceMeters != null ? Math.round(routeDistanceMeters) : null;

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

    const startNode = findBuildingNode(routingGraph, startBuilding.id, startBuilding.latitude, startBuilding.longitude);
    const endNode = findBuildingNode(routingGraph, endBuilding.id, endBuilding.latitude, endBuilding.longitude);

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
    setRouteSheetExpanded(false);
    cameraRef.current?.flyTo({
      center: [CPP_REGION.longitude, CPP_REGION.latitude],
      zoom: 16,
      duration: 500,
    });
  }, [recenterMap]);

  useEffect(() => {
    if (!routeFrom || !buildings.length) return;
    const b = buildings.find((b) => b.id === (routeFrom as string).split("_")[0]);
    if (b) { setStartBuilding(b); setRouteSheetExpanded(true); }
  }, [routeFrom, buildings]);

  useEffect(() => {
    if (!routeTo || !buildings.length) return;
    const b = buildings.find((b) => b.id === (routeTo as string).split("_")[0]);
    if (b) { setEndBuilding(b); setRouteSheetExpanded(true); }
  }, [routeTo, buildings]);

  useEffect(() => {
    if (!viewBuilding || !buildings.length) return;
    const b = buildings.find((b) => b.id === (viewBuilding as string).split("_")[0]);
    if (!b) return;
    cameraRef.current?.flyTo({ center: [b.longitude, b.latitude], zoom: 17, duration: 500 });
  }, [viewBuilding, buildings]);

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

    const intervalId = setInterval(fetchAllRooms, 300_000);
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

  const buildingGroups = useMemo(() => groupBuildings(buildings), [buildings]);

  const visibleGroups = useMemo(() => {
    if (activeFilters.length === 0) return buildingGroups;
    return buildingGroups.filter((group) =>
      group.allIds.some((id) => {
        const rooms = roomsMap[id];
        if (!rooms) return true;
        return rooms.some((room) =>
          applyRoomFilters(room, activeFilters, filterMode, favoriteIds),
        );
      }),
    );
  }, [buildingGroups, roomsMap, activeFilters, filterMode, favoriteIds]);

  const selectedGroupSections = useMemo((): BuildingSection[] | undefined => {
    if (!selected) return undefined;
    const group = buildingGroups.find((g) => g.primary.id === selected.id);
    if (!group || group.allIds.length === 1) return undefined;
    return [group.primary, ...group.aliases].map((b) => ({
      building: b,
      rooms: roomsMap[b.id] ?? [],
    }));
  }, [selected, buildingGroups, roomsMap]);

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
    setMarkersHidden(false);
  }

  function fitCameraToRoute() {
    const coordinates = routeGeoJSON?.geometry?.coordinates;
    if (!coordinates || coordinates.length === 0) return;

    const lngs = coordinates.map((c) => c[0]);
    const lats = coordinates.map((c) => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const lngCenter = (minLng + maxLng) / 2;
    const latCenter = (minLat + maxLat) / 2;
    const maxDim = Math.max(maxLng - minLng, maxLat - minLat);
    // Clamp zoom: log2 formula calibrated for campus-scale routes → 15–17
    const rawZoom = Math.log2(360 / (maxDim * 2));
    const zoom = Math.min(17, Math.max(15, rawZoom));

    cameraRef.current?.flyTo({
      center: [lngCenter, latCenter],
      zoom,
      duration: 500,
    });

    setRouteSheetExpanded(false);
  }

  function handleLocateBuilding(building: Building) {
    cameraRef.current?.flyTo({
      center: [building.longitude, building.latitude],
      zoom: 17,
      duration: 500,
    });
    setRouteSheetExpanded(false);
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

              {visibleGroups.filter((group) => {
                if (!markersHidden) return true;
                return group.primary.id === startBuilding?.id || group.primary.id === endBuilding?.id;
              }).map((group) => {
                const building = group.primary;
                const isStart = startBuilding?.id === building.id;
                const isEnd = endBuilding?.id === building.id;
                const isGrouped = group.allIds.length > 1;

                const groupRoomCount = group.allIds.reduce((sum, id) => {
                  const b = buildings.find((b) => b.id === id);
                  return sum + (b?.roomCount ?? 0);
                }, 0);
                const representativeBuilding =
                  [building, ...group.aliases].find((b) => b.roomCount > 0) ??
                  building;

                let bg: string, border: string, dot: string;
                if (isStart) {
                  bg = "#3b82f6"; border = "#3b82f6"; dot = "#fff";
                } else if (isEnd) {
                  bg = "#ef4444"; border = "#ef4444"; dot = "#fff";
                } else if (groupRoomCount === 0) {
                  bg = Colors.surface; border = Colors.borderMd; dot = Colors.muted;
                } else if (representativeBuilding.level === "low") {
                  bg = Colors.card; border = Colors.low; dot = Colors.low;
                } else if (representativeBuilding.level === "med") {
                  bg = Colors.card; border = Colors.med; dot = Colors.med;
                } else {
                  bg = Colors.card; border = Colors.high; dot = Colors.high;
                }

                const noRooms = groupRoomCount === 0;

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
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: bg,
                        borderColor: border,
                        borderWidth: 1,
                        borderRadius: 20,
                        paddingHorizontal: noRooms ? 6 : 7,
                        paddingVertical: noRooms ? 3 : 4,
                      }}
                    >
                      <View
                        style={{
                          width: noRooms ? 5 : 6,
                          height: noRooms ? 5 : 6,
                          borderRadius: 3,
                          backgroundColor: dot,
                        }}
                      />
                      <Text
                        style={{
                          color: Colors.text,
                          fontFamily: Fonts.bodySemiBold,
                          fontSize: noRooms ? 10 : 11,
                        }}
                      >
                        {building.code}
                        {isGrouped ? " +" : ""}
                      </Text>
                    </View>
                  </MLRN.Marker>
                );
              })}
            </MLRN.Map>

            {/* Backdrop — tapping outside the card closes the menu */}
            {routeSheetExpanded && (
              <Pressable
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 25 }}
                onPress={() => setRouteSheetExpanded(false)}
              />
            )}

            <FloatingMapSearchBar
              activeFilters={activeFilters}
              filterMode={filterMode}
              showFavorites={favorites.length > 0}
              onChangeFilters={setActiveFilters}
              onChangeFilterMode={setFilterMode}
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
              onLocateBuilding={handleLocateBuilding}
              routeActive={routeGeoJSON !== null && !routeSheetExpanded}
              routeMinutes={routeMinutes}
              routeMeters={routeMeters}
              markersHidden={markersHidden}
              onToggleMarkersHidden={() => setMarkersHidden((p) => !p)}
            />
          </>
        )}
      </View>

      <BuildingDetailSheet
        building={selected}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        activeFilters={activeFilters}
        sections={selectedGroupSections}
        onSetRouteFrom={(b) => {
          setStartBuilding(b);
          setSheetVisible(false);
          setRouteSheetExpanded(true);
        }}
        onSetRouteTo={(b) => {
          setEndBuilding(b);
          setSheetVisible(false);
          setRouteSheetExpanded(true);
        }}
        onViewOnMap={(b) => {
          setSheetVisible(false);
          cameraRef.current?.flyTo({ center: [b.longitude, b.latitude], zoom: 17, duration: 500 });
        }}
      />
    </SafeAreaView>
  );
}
