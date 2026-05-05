import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building } from "../../constants/mockData";

type RouteField = "from" | "to";

type Props = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  buildings: Building[];
  startBuilding: Building | null;
  endBuilding: Building | null;
  routeDistanceMeters?: number | null;
  routeWalkTimeSeconds?: number | null;
  onSelectStart: (building: Building) => void;
  onSelectEnd: (building: Building) => void;
  onClearRoute: () => void;
  onGo: () => void;
};

function sortBuildings(a: Building, b: Building) {
  const aNum = Number.parseInt(String(a.id), 10);
  const bNum = Number.parseInt(String(b.id), 10);

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum - bNum;
  }

  return String(a.name).localeCompare(String(b.name));
}

export default function RoutePlannerSheet({
    expanded,
    onExpandedChange,
    buildings,
    startBuilding,
    endBuilding,
    routeDistanceMeters,
    routeWalkTimeSeconds,
    onSelectStart,
    onSelectEnd,
    onClearRoute,
    onGo,
}: Props) {
  const insets = useSafeAreaInsets();

  const [activeField, setActiveField] = useState<RouteField>("to");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const source = buildings.slice().sort(sortBuildings);

    if (!q) return source;

    return source.filter((building) => {
      const name = String(building.name ?? "").toLowerCase();
      const code = String(building.code ?? "").toLowerCase();
      const id = String(building.id ?? "").toLowerCase();

      return name.includes(q) || code.includes(q) || id.includes(q);
    });
  }, [buildings, query]);

  function selectBuilding(building: Building) {
    if (activeField === "from") {
      onSelectStart(building);
      setActiveField("to");
    } else {
      onSelectEnd(building);
    }

    setQuery("");
  }

  const minutes =
    routeWalkTimeSeconds != null
      ? Math.max(1, Math.round(routeWalkTimeSeconds / 60))
      : null;

  const meters =
    routeDistanceMeters != null ? Math.round(routeDistanceMeters) : null;

  if (!expanded) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
      }}
    >
      <BlurView
        intensity={52}
        tint="dark"
        style={{
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          overflow: "hidden",
          backgroundColor: "rgba(20, 24, 31, 0.88)",
          borderColor: Colors.border,
          borderWidth: 1,
          paddingBottom: insets.bottom + 16,
          shadowColor: "#000",
          shadowOpacity: 0.32,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -10 },
          elevation: 12,
        }}
      >
        <Pressable
          onPress={() => onExpandedChange(false)}
          style={{
            alignItems: "center",
            paddingTop: 10,
            paddingBottom: 8,
          }}
        >
          <View
            style={{
              width: 44,
              height: 5,
              borderRadius: 999,
              backgroundColor: Colors.borderMd,
            }}
          />
        </Pressable>

        <View className="px-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text
              style={{
                color: Colors.text,
                fontFamily: Fonts.display,
                fontSize: 27,
              }}
            >
              Journey
            </Text>

            <Pressable
              onPress={() => onExpandedChange(false)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: Colors.card,
              }}
            >
              <Feather name="x" size={20} color={Colors.text} />
            </Pressable>
          </View>

          <View
            style={{
              borderRadius: 24,
              backgroundColor: "rgba(255,255,255,0.07)",
              borderColor: Colors.border,
              borderWidth: 1,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <Pressable
              onPress={() => setActiveField("from")}
              style={{
                paddingBottom: 12,
                borderBottomColor: Colors.border,
                borderBottomWidth: 1,
              }}
            >
              <Text
                style={{
                  color: Colors.muted,
                  fontFamily: Fonts.bodyMedium,
                  fontSize: 11,
                  letterSpacing: 1.4,
                }}
              >
                FROM
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  color: Colors.text,
                  fontFamily: Fonts.bodySemiBold,
                  fontSize: 15,
                  marginTop: 3,
                }}
              >
                {startBuilding?.name ?? "Choose starting building"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveField("to")}
              style={{ paddingTop: 12 }}
            >
              <Text
                style={{
                  color: Colors.muted,
                  fontFamily: Fonts.bodyMedium,
                  fontSize: 11,
                  letterSpacing: 1.4,
                }}
              >
                TO
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  color: Colors.text,
                  fontFamily: Fonts.bodySemiBold,
                  fontSize: 15,
                  marginTop: 3,
                }}
              >
                {endBuilding?.name ?? "Choose destination"}
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              borderRadius: 18,
              backgroundColor: Colors.bg,
              borderColor: Colors.border,
              borderWidth: 1,
              paddingHorizontal: 12,
              marginBottom: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Feather name="search" size={16} color={Colors.accent} />

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${
                activeField === "from" ? "start" : "destination"
              }`}
              placeholderTextColor={Colors.muted}
              style={{
                flex: 1,
                color: Colors.text,
                paddingVertical: 12,
                fontFamily: Fonts.body,
                fontSize: 14,
              }}
            />
          </View>

          <ScrollView
            style={{ maxHeight: 220 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {results.map((building, index) => (
              <Pressable
                key={building.id}
                onPress={() => selectBuilding(building)}
                style={{
                  paddingVertical: 12,
                  borderBottomColor: Colors.border,
                  borderBottomWidth: index < results.length - 1 ? 1 : 0,
                }}
              >
                <Text
                  style={{
                    color: Colors.text,
                    fontFamily: Fonts.bodySemiBold,
                    fontSize: 14,
                  }}
                >
                  {building.name}
                </Text>

                <Text
                  style={{
                    color: Colors.muted,
                    fontFamily: Fonts.body,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  Building {building.code}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {startBuilding && endBuilding && (
            <View
              style={{
                marginTop: 14,
                borderRadius: 24,
                backgroundColor: Colors.surface,
                padding: 16,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text
                    style={{
                      color: Colors.text,
                      fontFamily: Fonts.bodySemiBold,
                      fontSize: 18,
                    }}
                  >
                    {minutes ? `${minutes} min` : "Route ready"}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      color: Colors.muted,
                      fontFamily: Fonts.body,
                      fontSize: 12,
                      marginTop: 3,
                    }}
                  >
                    {meters ? `${meters} m` : "Campus walking route"}
                  </Text>
                </View>

                <Pressable
                    onPress={onGo}
                    disabled={!onGo || !startBuilding || !endBuilding || !routeDistanceMeters}
                    style={{
                        borderRadius: 18,
                        backgroundColor:
                        !onGo || !startBuilding || !endBuilding || !routeDistanceMeters
                            ? Colors.border
                            : Colors.accent,
                        paddingHorizontal: 22,
                        paddingVertical: 12,
                    }}
                >
                  <Text
                    style={{
                        color: Colors.bg,
                        fontFamily: Fonts.bodySemiBold,
                        fontSize: 16,
                    }}
                  >
                    GO
                  </Text>
                </Pressable>
              </View>

              <Pressable onPress={onClearRoute} style={{ marginTop: 12 }}>
                <Text
                  style={{
                    color: Colors.accent,
                    fontFamily: Fonts.bodySemiBold,
                    fontSize: 13,
                  }}
                >
                  Clear route
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </BlurView>
    </View>
  );
}
