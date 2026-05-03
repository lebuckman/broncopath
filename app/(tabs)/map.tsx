import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView from "react-native-maps";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building, Room } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import { useFavorites } from "../../hooks/useFavorites";
import { getRooms } from "../../lib/api";
import { getCachedBuildings, getCachedRooms } from "../../lib/dataCache";
import {
  FILTER_OPTIONS,
  applyRoomFilters,
  type FilterMode,
} from "../../lib/roomFilters";
import { CPP_REGION } from "../../constants/campus";
import BuildingMarker from "../../components/map/BuildingMarker";
import MapLegend from "../../components/map/MapLegend";
import BuildingDetailSheet from "../../components/building/BuildingDetailSheet";
import ChipFilter from "../../components/ui/ChipFilter";

export default function MapScreen() {
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
    buildings.forEach((b) => {
      getRooms(b.id).then((rooms) => {
        setRoomsMap((prev) => ({ ...prev, [b.id]: rooms }));
      });
    });
  }, [buildings]);

  useEffect(() => {
    if (favorites.length === 0 && activeFilters.includes("Favorites")) {
      setActiveFilters((prev) => prev.filter((f) => f !== "Favorites"));
    }
  }, [favorites]);

  const favoriteIds = favorites.map((f) => f.roomId);

  const filterOptions =
    favorites.length > 0
      ? ["All", "Favorites", ...FILTER_OPTIONS.slice(1)]
      : FILTER_OPTIONS;

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
        <ChipFilter
          options={filterOptions}
          active={activeFilters}
          onChange={setActiveFilters}
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
              style={{ width: "100%", height: mapHeight }}
              initialRegion={CPP_REGION}
              showsUserLocation
              showsMyLocationButton={false}
              showsCompass={false}
              toolbarEnabled={false}
            >
              {visibleBuildings.map((building) => (
                <BuildingMarker
                  key={building.id}
                  building={building}
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
      />
    </SafeAreaView>
  );
}
