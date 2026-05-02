import { useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView from "react-native-maps";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import { CPP_REGION } from "../../constants/campus";
import BuildingMarker from "../../components/map/BuildingMarker";
import MapLegend from "../../components/map/MapLegend";
import BuildingDetailSheet from "../../components/building/BuildingDetailSheet";
import ChipFilter from "../../components/ui/ChipFilter";

const FILTER_OPTIONS = ["All", "Quiet", "Moderate", "Busy"];

function applyFilters(buildings: Building[], filters: string[]): Building[] {
  if (filters.length === 0) return buildings;
  return buildings.filter(
    (b) =>
      (filters.includes("Quiet") && b.level === "low") ||
      (filters.includes("Moderate") && b.level === "med") ||
      (filters.includes("Busy") && b.level === "high"),
  );
}

export default function MapScreen() {
  const { buildings, loading } = useBuildings();
  const [selected, setSelected] = useState<Building | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const visibleBuildings = applyFilters(buildings, activeFilters);

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
        <Text
          className="text-[12px] mt-1"
          style={{ color: Colors.muted, fontFamily: Fonts.body }}
        >
          Tap any building to explore
        </Text>
      </View>

      <View className="mb-4">
        <ChipFilter
          options={FILTER_OPTIONS}
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
      />
    </SafeAreaView>
  );
}
