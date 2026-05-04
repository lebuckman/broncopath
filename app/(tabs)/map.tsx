import { useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
//import MapView from "react-native-maps"; replace with maplibre
import { Map, Camera, Marker } from "@maplibre/maplibre-react-native";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building, Room } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import { useFavorites } from "../../hooks/useFavorites";
import { getRooms } from "../../lib/api";
import { getCachedBuildings, getCachedRooms } from "../../lib/dataCache";
import { applyRoomFilters, type FilterMode } from "../../lib/roomFilters";
import { CPP_REGION } from "../../constants/campus";
import MapLegend from "../../components/map/MapLegend";
import BuildingDetailSheet from "../../components/building/BuildingDetailSheet";
import GroupedChipFilter from "../../components/ui/GroupedChipFilter";

export default function MapScreen() {
  const { recenterMap } = useLocalSearchParams<{ recenterMap?: string }>();
  const cameraRef = useRef<any>(null);
  const { buildings, loading } = useBuildings();
  const { favorites } = useFavorites();
  const [roomsMap, setRoomsMap] = useState<Record<string, Room[]>>(() => {
    const map: Record<string, Room[]> = {};
    getCachedBuildings().forEach((b) => {
      map[b.id] = getCachedRooms(b.id);
    });
    return map;
  });
  const [selected, setSelected] = useState<Building | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("any");

  useEffect(() => {
    if (recenterMap) {
      cameraRef.current?.setCamera({
        centerCoordinate: [CPP_REGION.longitude, CPP_REGION.latitude],
        zoomLevel: 16,
        animationDuration: 500,
      });
    }
  }, [recenterMap]);

  const buildingIds = buildings.map((b) => b.id).join(",");

  useEffect(() => {
    if (!buildingIds) return;

    function fetchAllRooms() {
      buildings.forEach((b) => {
        getRooms(b.id)
          .then((rooms) => {
            setRoomsMap((prev) => ({ ...prev, [b.id]: rooms }));
          })
          .catch(() => {});
      });
    }

    fetchAllRooms();
    const id = setInterval(fetchAllRooms, 60_000);
    return () => clearInterval(id);
  }, [buildingIds]);

  useEffect(() => {
    if (favorites.length === 0 && activeFilters.includes("Favorites")) {
      setActiveFilters((prev) => prev.filter((f) => f !== "Favorites"));
    }
  }, [favorites]);

  const favoriteIds = favorites.map((f) => f.roomId);

  const visibleBuildings = buildings.filter((b) => {
    if (activeFilters.length === 0) return true;
    const rooms = roomsMap[b.id];
    if (!rooms) return true;
    return rooms.some((r) =>
      applyRoomFilters(r, activeFilters, filterMode, favoriteIds),
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
      {/* Header */}
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

      {/* Map */}
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setMapHeight(e.nativeEvent.layout.height)}
      >
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
            <Map
              style={{ width: "100%", height: mapHeight }}
              mapStyle="https://tiles.openfreemap.org/styles/liberty"
              compass={false}
              logo={false}
              attribution={false}
              onDidFinishLoadingStyle={() => console.log("Map style loaded")}
              onDidFailLoadingMap={(event) =>
                console.log("Map failed", event.nativeEvent)
              }
            >
              <Camera
                ref={cameraRef}
                zoom={16}
                initialViewState={{
                  center: [CPP_REGION.longitude, CPP_REGION.latitude],
                  zoom: 16,
                }}
              />

              {visibleBuildings.map((building) => (
                <Marker
                  key={building.id}
                  id={building.id}
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
                </Marker>
              ))}
            </Map>

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
