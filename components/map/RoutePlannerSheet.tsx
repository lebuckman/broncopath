import { useRef, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
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
type RouteChoice = "shortest" | "leastCrowded";

type Props = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  buildings: Building[];
  startBuilding: Building | null;
  endBuilding: Building | null;

  routeChoice: RouteChoice;
  onRouteChoiceChange: (choice: RouteChoice) => void;
  showLeastCrowdedOption: boolean;

  shortestDistanceMeters?: number | null;
  shortestWalkTimeSeconds?: number | null;
  leastCrowdedDistanceMeters?: number | null;
  leastCrowdedWalkTimeSeconds?: number | null;

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

  routeChoice,
  onRouteChoiceChange,
  showLeastCrowdedOption,

  shortestDistanceMeters,
  shortestWalkTimeSeconds,
  leastCrowdedDistanceMeters,
  leastCrowdedWalkTimeSeconds,

  onSelectStart,
  onSelectEnd,
  onClearRoute,
  onGo,
  onLocateBuilding,
}: Props) {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [activeField, setActiveField] = useState<RouteField>("from");
  const [query, setQuery] = useState("");

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 50) onExpandedChange(false);
      },
    }),
  ).current;

  useEffect(() => {
    if (expanded) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.poly(3)),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.poly(3)),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 160,
          easing: Easing.in(Easing.poly(2)),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.poly(2)),
          useNativeDriver: true,
        }),
      ]).start();
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
      if (!endBuilding) setActiveField("to");
    } else {
      onSelectEnd(building);
      if (!startBuilding) setActiveField("from");
    }
    setQuery("");
  }

  function handleSwap() {
    if (!startBuilding || !endBuilding) return;
    onSelectStart(endBuilding);
    onSelectEnd(startBuilding);
  }

  const selectedWalkTimeSeconds =
    routeChoice === "leastCrowded"
      ? leastCrowdedWalkTimeSeconds
      : shortestWalkTimeSeconds;

  const selectedDistanceMeters =
    routeChoice === "leastCrowded"
      ? leastCrowdedDistanceMeters
      : shortestDistanceMeters;

  const minutes =
    selectedWalkTimeSeconds != null
      ? Math.max(1, Math.round(selectedWalkTimeSeconds / 60))
      : null;
  const meters =
    selectedDistanceMeters != null ? Math.round(selectedDistanceMeters) : null;

  const canSwap = !!startBuilding && !!endBuilding;
  const showSummary = !!startBuilding && !!endBuilding;

  return (
    <Animated.View
      pointerEvents={expanded ? "box-none" : "none"}
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 88,
        maxHeight: SCREEN_H * 0.65,
        zIndex: 30,
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
      }}
    >
      <BlurView
        intensity={52}
        tint="dark"
        style={{
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: "rgba(20, 24, 31, 0.88)",
          borderColor: Colors.border,
          borderWidth: 1,
          shadowColor: "#000",
          shadowOpacity: 0.32,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -6 },
          elevation: 12,
        }}
      >
        <View style={{ paddingBottom: 16 }}>
          {/* Drag handle */}
          <View
            style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}
            {...panResponder.panHandlers}
          >
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

          <View style={{ paddingHorizontal: 20 }}>
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
              style={{ maxHeight: SCREEN_H * 0.22 }}
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

            {/* Route choice toggle */}
            {showLeastCrowdedOption && showSummary && (
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  marginTop: 10,
                  marginBottom: 2,
                }}
              >
                <Pressable
                  onPress={() => onRouteChoiceChange("shortest")}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor:
                      routeChoice === "shortest" ? Colors.accent : Colors.card,
                    borderColor: Colors.border,
                    borderWidth: 1,
                  }}
                >
                  <Text
                    style={{
                      color:
                        routeChoice === "shortest" ? Colors.bg : Colors.text,
                      fontFamily: Fonts.bodySemiBold,
                      fontSize: 13,
                    }}
                  >
                    Shortest
                  </Text>
                  <Text
                    style={{
                      color:
                        routeChoice === "shortest" ? Colors.bg : Colors.muted,
                      fontFamily: Fonts.body,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    Fastest walk
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onRouteChoiceChange("leastCrowded")}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor:
                      routeChoice === "leastCrowded"
                        ? Colors.accent
                        : Colors.card,
                    borderColor: Colors.border,
                    borderWidth: 1,
                  }}
                >
                  <Text
                    style={{
                      color:
                        routeChoice === "leastCrowded"
                          ? Colors.bg
                          : Colors.text,
                      fontFamily: Fonts.bodySemiBold,
                      fontSize: 13,
                    }}
                  >
                    Least crowded
                  </Text>
                  <Text
                    style={{
                      color:
                        routeChoice === "leastCrowded"
                          ? Colors.bg
                          : Colors.muted,
                      fontFamily: Fonts.body,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    Avoids traffic
                  </Text>
                </Pressable>
              </View>
            )}

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
                    disabled={!selectedDistanceMeters}
                    style={{
                      borderRadius: 14,
                      backgroundColor: selectedDistanceMeters
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
