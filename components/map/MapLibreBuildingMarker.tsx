import { View, Text, StyleSheet } from "react-native";
import * as MLRN from "@maplibre/maplibre-react-native";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building, DensityLevel } from "../../constants/mockData";

interface Props {
  building: Building;
  selected?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  onPress: (building: Building) => void;
}

function markerColors(level: DensityLevel) {
  if (level === "low") return { bg: Colors.lowBg, border: Colors.low, dot: Colors.low };
  if (level === "med") return { bg: Colors.medBg, border: Colors.med, dot: Colors.med };
  return { bg: Colors.highBg, border: Colors.high, dot: Colors.high };
}

export default function MapLibreBuildingMarker({
  building,
  selected,
  isStart,
  isEnd,
  onPress,
}: Props) {
  const densityColors = markerColors(building.level);

  const colors = isStart
    ? { bg: "#1d4ed8", border: "#60a5fa", dot: "#bfdbfe" }
    : isEnd
      ? { bg: "#991b1b", border: "#f87171", dot: "#fecaca" }
      : densityColors;

  return (
    <MLRN.Marker
      id={`expanded-building-${building.id}`}
      lngLat={[building.longitude, building.latitude]}
      anchor="center"
      onPress={() => onPress(building)}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.bg,
            borderColor: colors.border,
            transform: [{ scale: selected ? 1.08 : 1 }],
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: colors.dot }]} />
        <Text style={styles.label}>{building.code}</Text>
      </View>
    </MLRN.Marker>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.text,
  },
});