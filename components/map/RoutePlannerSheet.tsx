import { useRef, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";

import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building } from "../../constants/mockData";

type RouteField = "from" | "to";

const SCREEN_H = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_H * 0.74;

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
  onLocateBuilding: (building: Building) => void;
};

function sortBuildings(a: Building, b: Building) {
  const aNum = Number.parseInt(String(a.id), 10);
  const bNum = Number.parseInt(String(b.id), 10);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
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
  onLocateBuilding,
}: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const [activeField, setActiveField] = useState<RouteField>("from");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (expanded) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.poly(4)),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 240,
        easing: Easing.in(Easing.poly(2)),
        useNativeDriver: true,
      }).start();
    }
  }, [expanded]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = buildings.slice().sort(sortBuildings);
    if (!q) return source;
    return source.filter((b) => {
      const name = String(b.name ?? "").toLowerCase();
      const code = String(b.code ?? "").toLowerCase();
      const id = String(b.id ?? "").toLowerCase();
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

  function handleSwap() {
    if (!startBuilding || !endBuilding) return;
    onSelectStart(endBuilding);
    onSelectEnd(startBuilding);
  }

  const minutes =
    routeWalkTimeSeconds != null
      ? Math.max(1, Math.round(routeWalkTimeSeconds / 60))
      : null;
  const meters =
    routeDistanceMeters != null ? Math.round(routeDistanceMeters) : null;

  const canSwap = !!startBuilding && !!endBuilding;
  const showSummary = !!startBuilding && !!endBuilding;

  return (
    <Animated.View
      pointerEvents={expanded ? "box-none" : "none"}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: SHEET_HEIGHT,
        zIndex: 30,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <BlurView
        intensity={52}
        tint="dark"
        style={{
          height: "100%",
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          overflow: "hidden",
          backgroundColor: "rgba(20, 24, 31, 0.88)",
          borderColor: Colors.border,
          borderWidth: 1,
          shadowColor: "#000",
          shadowOpacity: 0.32,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -10 },
          elevation: 12,
        }}
      >
        <View style={{ flex: 1, paddingBottom: 16 }}>
          {/* Drag handle */}
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 999,
                backgroundColor: Colors.borderMd,
              }}
            />
          </View>

          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingBottom: 14,
            }}
          >
            <Text
              style={{
                color: Colors.text,
                fontFamily: Fonts.display,
                fontSize: 24,
              }}
            >
              Routes
            </Text>
            <Pressable
              onPress={() => onExpandedChange(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: Colors.card,
              }}
            >
              <Feather name="x" size={17} color={Colors.text} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 20, flex: 1 }}>
            {/* FROM / TO card */}
            <View
              style={{
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderColor: Colors.border,
                borderWidth: 1,
                marginBottom: 12,
                position: "relative",
              }}
            >
              {/* FROM row */}
              <Pressable
                onPress={() => setActiveField("from")}
                style={{
                  paddingVertical: 13,
                  paddingRight: 16,
                  paddingLeft: 14,
                  borderBottomColor: Colors.border,
                  borderBottomWidth: 1,
                  borderLeftWidth: 3,
                  borderLeftColor:
                    activeField === "from" ? Colors.accent : "transparent",
                  borderTopLeftRadius: 20,
                }}
              >
                <Text
                  style={{
                    color: activeField === "from" ? Colors.accent : Colors.muted,
                    fontFamily: Fonts.bodyMedium,
                    fontSize: 10,
                    letterSpacing: 1.2,
                    marginBottom: 3,
                  }}
                >
                  FROM
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: startBuilding ? Colors.text : Colors.muted,
                    fontFamily: Fonts.bodySemiBold,
                    fontSize: 14,
                  }}
                >
                  {startBuilding?.name ?? "Choose starting building"}
                </Text>
              </Pressable>

              {/* TO row */}
              <Pressable
                onPress={() => setActiveField("to")}
                style={{
                  paddingVertical: 13,
                  paddingRight: 16,
                  paddingLeft: 14,
                  borderLeftWidth: 3,
                  borderLeftColor:
                    activeField === "to" ? Colors.accent : "transparent",
                  borderBottomLeftRadius: 20,
                }}
              >
                <Text
                  style={{
                    color: activeField === "to" ? Colors.accent : Colors.muted,
                    fontFamily: Fonts.bodyMedium,
                    fontSize: 10,
                    letterSpacing: 1.2,
                    marginBottom: 3,
                  }}
                >
                  TO
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: endBuilding ? Colors.text : Colors.muted,
                    fontFamily: Fonts.bodySemiBold,
                    fontSize: 14,
                  }}
                >
                  {endBuilding?.name ?? "Choose destination"}
                </Text>
              </Pressable>

              {/* Swap button */}
              <Pressable
                onPress={handleSwap}
                disabled={!canSwap}
                style={{
                  position: "absolute",
                  right: 14,
                  top: "50%",
                  marginTop: -16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: Colors.surface,
                  borderWidth: 1,
                  borderColor: Colors.borderMd,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: canSwap ? 1 : 0.35,
                }}
              >
                <Feather name="shuffle" size={13} color={Colors.muted} />
              </Pressable>
            </View>

            {/* Search input */}
            <View
              style={{
                borderRadius: 16,
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
              <Feather name="search" size={15} color={Colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={
                  activeField === "from"
                    ? "Search starting building…"
                    : "Search destination…"
                }
                placeholderTextColor={Colors.muted}
                style={{
                  flex: 1,
                  color: Colors.text,
                  paddingVertical: 11,
                  fontFamily: Fonts.body,
                  fontSize: 13,
                }}
              />
            </View>

            {/* Building list */}
            <ScrollView
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {query.trim() !== "" && results.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <Feather name="search" size={22} color={Colors.muted} />
                  <Text
                    style={{
                      color: Colors.muted,
                      fontFamily: Fonts.body,
                      fontSize: 13,
                      marginTop: 8,
                    }}
                  >
                    No buildings found
                  </Text>
                </View>
              ) : (
                results.map((building, index) => (
                  <View
                    key={building.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderBottomColor: Colors.border,
                      borderBottomWidth: index < results.length - 1 ? 1 : 0,
                    }}
                  >
                    {/* Row tap → selects from/to */}
                    <Pressable
                      onPress={() => selectBuilding(building)}
                      style={{ flex: 1, paddingVertical: 11 }}
                    >
                      <Text
                        style={{
                          color: Colors.text,
                          fontFamily: Fonts.bodySemiBold,
                          fontSize: 13,
                        }}
                      >
                        {building.name}
                      </Text>
                      <Text
                        style={{
                          color: Colors.muted,
                          fontFamily: Fonts.body,
                          fontSize: 11,
                          marginTop: 1,
                        }}
                      >
                        {building.code}
                      </Text>
                    </Pressable>

                    {/* Locate icon → fly camera to building */}
                    <Pressable
                      onPress={() => onLocateBuilding(building)}
                      hitSlop={8}
                      style={{ paddingHorizontal: 8, paddingVertical: 11 }}
                    >
                      <Feather name="map-pin" size={14} color={Colors.muted} />
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Route summary + CTA */}
            {showSummary && (
              <View
                style={{
                  borderRadius: 18,
                  backgroundColor: Colors.surface,
                  borderColor: Colors.border,
                  borderWidth: 1,
                  padding: 14,
                  marginTop: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: Colors.text,
                          fontFamily: Fonts.bodySemiBold,
                          fontSize: 18,
                        }}
                      >
                        {minutes ? `${minutes} min` : "—"}
                      </Text>
                      {meters != null && (
                        <Text
                          style={{
                            color: Colors.muted,
                            fontFamily: Fonts.body,
                            fontSize: 12,
                          }}
                        >
                          · {meters} m
                        </Text>
                      )}
                    </View>
                    <Pressable onPress={onClearRoute} style={{ marginTop: 4 }}>
                      <Text
                        style={{
                          color: Colors.muted,
                          fontFamily: Fonts.body,
                          fontSize: 11,
                        }}
                      >
                        Clear route
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={onGo}
                    disabled={!routeDistanceMeters}
                    style={{
                      borderRadius: 14,
                      backgroundColor: routeDistanceMeters
                        ? Colors.accent
                        : Colors.border,
                      paddingHorizontal: 22,
                      paddingVertical: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.bg,
                        fontFamily: Fonts.bodySemiBold,
                        fontSize: 15,
                      }}
                    >
                      GO
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
}
