import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import MapView from "react-native-maps";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building, Room } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import { useFavorites } from "../../hooks/useFavorites";
import { getRooms } from "../../lib/api";
import { getCachedBuildings, getCachedRooms } from "../../lib/dataCache";
import { applyRoomFilters, type FilterMode } from "../../lib/roomFilters";
import { groupBuildings } from "../../lib/buildingGroups";
import { CPP_REGION } from "../../constants/campus";
import BuildingMarker from "../../components/map/BuildingMarker";
import MapLegend from "../../components/map/MapLegend";
import BuildingDetailSheet from "../../components/building/BuildingDetailSheet";
import GroupedChipFilter from "../../components/ui/GroupedChipFilter";

export default function MapScreen() {
  const { recenterMap, focusBuildingId } = useLocalSearchParams<{ recenterMap?: string; focusBuildingId?: string }>();
  const mapRef = useRef<MapView>(null);
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
    if (recenterMap) mapRef.current?.animateToRegion(CPP_REGION, 500);
  }, [recenterMap]);

  const buildingIds = buildings.map((b) => b.id).join(",");

  const buildingGroups = useMemo(
    () => groupBuildings(buildings.filter((b) => b.id !== "999")),
    [buildings],
  );

  useEffect(() => {
    if (!focusBuildingId || !buildingGroups.length) return;
    const group = buildingGroups.find((g) => g.allIds.includes(focusBuildingId));
    if (!group) return;
    const { primary } = group;
    mapRef.current?.animateToRegion(
      { latitude: primary.latitude, longitude: primary.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 },
      600,
    );
    setSelected(primary);
    setSheetVisible(true);
  }, [focusBuildingId, buildingGroups]);

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

  const visibleGroups = useMemo(
    () =>
      buildingGroups.filter((group) => {
        const groupRooms = group.allIds.flatMap((id) => roomsMap[id] ?? []);
        if (groupRooms.length === 0) return false;
        if (activeFilters.length === 0) return true;
        return groupRooms.some((r) =>
          applyRoomFilters(r, activeFilters, filterMode, favoriteIds),
        );
      }),
    [buildingGroups, roomsMap, activeFilters, filterMode, favoriteIds],
  );

  const selectedGroupRooms = useMemo(() => {
    if (!selected) return undefined;
    const group = buildingGroups.find((g) => g.primary.id === selected.id);
    if (!group || group.aliases.length === 0) return undefined;
    return group.allIds.flatMap((id) => roomsMap[id] ?? []);
  }, [selected, buildingGroups, roomsMap]);

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
            <MapView
              ref={mapRef}
              style={{ width: "100%", height: mapHeight }}
              initialRegion={CPP_REGION}
              showsUserLocation
              showsMyLocationButton={false}
              showsCompass={false}
              toolbarEnabled={false}
            >
              {visibleGroups.map((group) => (
                <BuildingMarker
                  key={group.primary.id}
                  building={group.primary}
                  onPress={handleMarkerPress}
                />
              ))}
            </MapView>

            <MapLegend />
          </>
        )}
      </View>

      <BuildingDetailSheet
        building={selected}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        activeFilters={activeFilters}
        preloadedRooms={selectedGroupRooms}
      />
    </SafeAreaView>
  );
}
