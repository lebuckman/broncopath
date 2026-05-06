import { View, Text } from "react-native";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";

const ENTRIES = [
  { dot: Colors.low, label: "Quiet" },
  { dot: Colors.med, label: "Moderate" },
  { dot: Colors.high, label: "Busy" },
] as const;

export default function MapLegend() {
  return (
    <View
      style={{
        flexDirection: "column",
        backgroundColor: "rgba(20,24,31,0.82)",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 6,
      }}
    >
      {ENTRIES.map(({ dot, label }) => (
        <View
          key={label}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: dot,
            }}
          />
          <Text
            style={{
              fontSize: 11,
              fontFamily: Fonts.body,
              color: Colors.muted,
            }}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}
