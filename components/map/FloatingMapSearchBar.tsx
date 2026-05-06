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
import GroupedChipFilter from "../ui/GroupedChipFilter";
import { closeAllDirectionButtons } from "../../lib/directionsSignal";
import type { FilterMode } from "../../lib/roomFilters";
import type { Building } from "../../constants/mockData";

const SCREEN_H = Dimensions.get("window").height;
const BG = "rgba(20, 24, 31, 0.82)";
const BLUR_INTENSITY = 45;

type RouteField = "from" | "to";

function sortBuildings(a: Building, b: Building) {
  const aNum = Number.parseInt(String(a.id), 10);
  const bNum = Number.parseInt(String(b.id), 10);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return String(a.name).localeCompare(String(b.name));
}

type Props = {
  activeFilters: string[];
  filterMode: FilterMode;
  showFavorites: boolean;
  onChangeFilters: (filters: string[]) => void;
  onChangeFilterMode: (mode: FilterMode) => void;
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  buildings: Building[];
  startBuilding: Building | null;
  endBuilding: Building | null;
  routeDistanceMeters: number | null;
  routeWalkTimeSeconds: number | null;
  onSelectStart: (b: Building) => void;
  onSelectEnd: (b: Building) => void;
  onClearRoute: () => void;
  onGo: () => void;
  onLocateBuilding: (b: Building) => void;
  routeActive: boolean;
  routeMinutes: number | null;
  routeMeters: number | null;
  markersHidden: boolean;
  onToggleMarkersHidden: () => void;
};

export default function FloatingMapSearchBar({
  activeFilters,
  filterMode,
  showFavorites,
  onChangeFilters,
  onChangeFilterMode,
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
  routeActive,
  routeMinutes,
  routeMeters,
  markersHidden,
  onToggleMarkersHidden,
}: Props) {
  // Content area: grows below the bar
  const contentHeightAnim = useRef(new Animated.Value(0)).current;
  const contentOpacityAnim = useRef(new Animated.Value(0)).current;
  const handleHeightAnim = useRef(new Animated.Value(0)).current;

  // Filter popup — separate BlurView above the card, independent of menu open state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;

  // Route pill
  const pillAnim = useRef(new Animated.Value(routeActive && !expanded ? 1 : 0)).current;
  const [pillVisible, setPillVisible] = useState(routeActive && !expanded);

  const [activeField, setActiveField] = useState<RouteField>("from");
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<ScrollView>(null);

  // Swipe-down to close — attached to drag handle only
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 50) onExpandedChange(false);
      },
    }),
  ).current;

  // Main expand / collapse
  useEffect(() => {
    const opening = expanded;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    Animated.parallel([
      Animated.timing(contentHeightAnim, {
        toValue: opening ? SCREEN_H * 0.58 : 0,
        duration: opening ? 300 : 220,
        easing: opening ? Easing.out(Easing.poly(3)) : Easing.in(Easing.poly(2)),
        useNativeDriver: false,
      }),
      Animated.timing(contentOpacityAnim, {
        toValue: opening ? 1 : 0,
        duration: opening ? 240 : 160,
        easing: opening ? Easing.out(Easing.poly(3)) : Easing.in(Easing.poly(2)),
        useNativeDriver: true,
      }),
      Animated.timing(handleHeightAnim, {
        toValue: opening ? 20 : 0,
        duration: opening ? 220 : 180,
        easing: opening ? Easing.out(Easing.poly(3)) : Easing.in(Easing.poly(2)),
        useNativeDriver: false,
      }),
    ]).start();

    if (opening) {
      // Focus search input after animation gets underway
      focusTimer = setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      setQuery("");
      inputRef.current?.blur();
    }

    return () => {
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [expanded]);

  // Filter popup animation
  useEffect(() => {
    if (filtersOpen) {
      setFiltersVisible(true);
      Animated.timing(filterAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.poly(3)),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(filterAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.poly(2)),
        useNativeDriver: true,
      }).start(() => setFiltersVisible(false));
    }
  }, [filtersOpen]);

  // Route pill — only visible when route active and menu is closed
  useEffect(() => {
    const shouldShow = routeActive && !expanded;
    if (shouldShow) {
      setPillVisible(true);
      Animated.timing(pillAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(pillAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => setPillVisible(false));
    }
  }, [routeActive, expanded]);

  useEffect(() => {
    listRef.current?.scrollTo({ y: 0, animated: false });
  }, [query]);

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

  const minutes =
    routeWalkTimeSeconds != null
      ? Math.max(1, Math.round(routeWalkTimeSeconds / 60))
      : null;
  const meters =
    routeDistanceMeters != null ? Math.round(routeDistanceMeters) : null;

  const filterLabel = useMemo(() => {
    if (activeFilters.length === 0) return "Filters";
    if (activeFilters.length === 1) return activeFilters[0];
    return `${activeFilters.length} active`;
  }, [activeFilters]);

  const hasActiveFilters = activeFilters.length > 0;
  const canSwap = !!startBuilding && !!endBuilding;
  const showSummary = !!startBuilding && !!endBuilding;

  const filterTranslate = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  const pillTranslate = pillAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", bottom: 20, left: 16, right: 16, zIndex: 30 }}
    >
      {/* Route pill — right-aligned, above everything */}
      {pillVisible && (
        <Animated.View
          style={{
            opacity: pillAnim,
            transform: [{ translateY: pillTranslate }],
            alignSelf: "flex-end",
            marginBottom: 8,
          }}
        >
          <BlurView
            intensity={BLUR_INTENSITY}
            tint="dark"
            style={{
              borderRadius: 20,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: Colors.border,
              backgroundColor: BG,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 7,
                gap: 7,
              }}
            >
              <View
                style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent }}
              />
              <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 12 }}>
                {routeMinutes != null ? `${routeMinutes} min` : "Route active"}
              </Text>
              {routeMeters != null && (
                <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12 }}>
                  · {routeMeters} m
                </Text>
              )}
              <Pressable onPress={onToggleMarkersHidden} hitSlop={8}>
                <Feather
                  name={markersHidden ? "eye-off" : "eye"}
                  size={13}
                  color={markersHidden ? Colors.accent : Colors.muted}
                />
              </Pressable>
              <Pressable onPress={() => onExpandedChange(true)} hitSlop={8} style={{ marginLeft: 2 }}>
                <Feather name="edit-2" size={13} color={Colors.muted} />
              </Pressable>
              <Pressable onPress={onClearRoute} hitSlop={8}>
                <Feather name="x" size={14} color={Colors.muted} />
              </Pressable>
            </View>
          </BlurView>
        </Animated.View>
      )}

      {/* Filter popup — separate card above the main card, always accessible */}
      {filtersVisible && (
        <Animated.View
          style={{
            opacity: filterAnim,
            transform: [{ translateY: filterTranslate }],
            marginBottom: 8,
          }}
        >
          <BlurView
            intensity={BLUR_INTENSITY}
            tint="dark"
            style={{
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: Colors.border,
              backgroundColor: BG,
              paddingVertical: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                marginBottom: 10,
              }}
            >
              <Text
                style={{ color: Colors.text, fontFamily: Fonts.bodySemiBold, fontSize: 13 }}
              >
                {filterLabel}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: Colors.surface,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  onPress={() => onChangeFilterMode("any")}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: filterMode === "any" ? Colors.accentBg : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: Fonts.bodyMedium,
                      color: filterMode === "any" ? Colors.accent : Colors.muted,
                    }}
                  >
                    Any
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onChangeFilterMode("all")}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: filterMode === "all" ? Colors.accentBg : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: Fonts.bodyMedium,
                      color: filterMode === "all" ? Colors.accent : Colors.muted,
                    }}
                  >
                    All
                  </Text>
                </Pressable>
              </View>
            </View>
            <GroupedChipFilter
              active={activeFilters}
              onChange={onChangeFilters}
              showFavorites={showFavorites}
            />
          </BlurView>
        </Animated.View>
      )}

      {/* Main card */}
      <BlurView
        intensity={BLUR_INTENSITY}
        tint="dark"
        style={{
          borderRadius: 26,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: Colors.border,
          backgroundColor: BG,
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {/* Drag handle — only occupies space when menu is expanded */}
        <Animated.View style={{ maxHeight: handleHeightAnim, overflow: "hidden" }}>
          <View
            style={{ alignItems: "center", paddingTop: 8, paddingBottom: 6 }}
            {...panResponder.panHandlers}
          >
            <View
              style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: Colors.borderMd }}
            />
          </View>
        </Animated.View>

        {/* Bar row — search input + filter button */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 8,
          }}
        >
          {/* Input pill */}
          <View
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.07)",
              borderColor: Colors.border,
              borderWidth: 1,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Feather name="search" size={16} color="#fff" />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => {
                closeAllDirectionButtons();
                if (!expanded) onExpandedChange(true);
              }}
              placeholder={
                !expanded
                  ? "Search buildings or plan a route"
                  : activeField === "from"
                  ? "Search starting building…"
                  : "Search destination…"
              }
              placeholderTextColor={Colors.muted}
              style={{
                flex: 1,
                color: Colors.text,
                paddingVertical: 0,
                fontFamily: Fonts.body,
                fontSize: 13,
              }}
            />
          </View>

          {/* Filter button — independent toggle, no menu coupling */}
          <Pressable
            onPress={() => setFiltersOpen((prev) => !prev)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                hasActiveFilters || filtersOpen
                  ? Colors.accentBg
                  : "rgba(255,255,255,0.07)",
              borderColor: hasActiveFilters || filtersOpen ? Colors.accent : Colors.border,
              borderWidth: 1,
            }}
          >
            <Feather
              name="sliders"
              size={16}
              color={hasActiveFilters || filtersOpen ? Colors.accent : Colors.text}
            />
          </Pressable>
        </View>

        {/* Expandable content — no separator, flows directly from bar */}
        <Animated.View style={{ maxHeight: contentHeightAnim, overflow: "hidden" }}>
          <Animated.View style={{ opacity: contentOpacityAnim }}>
            <View style={{ paddingHorizontal: 8, paddingTop: 4, paddingBottom: 16 }}>
              {/* FROM / TO card */}
              <View
                style={{
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderColor: Colors.border,
                  borderWidth: 1,
                  marginBottom: 12,
                  position: "relative",
                }}
              >
                <Pressable
                  onPress={() => setActiveField("from")}
                  style={{
                    paddingVertical: 12,
                    paddingRight: 16,
                    paddingLeft: 14,
                    borderBottomColor: Colors.border,
                    borderBottomWidth: 1,
                    borderLeftWidth: 3,
                    borderLeftColor: activeField === "from" ? Colors.accent : "transparent",
                    borderTopLeftRadius: 18,
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
                      fontSize: 13,
                    }}
                  >
                    {startBuilding?.name ?? "Choose starting building"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setActiveField("to")}
                  style={{
                    paddingVertical: 12,
                    paddingRight: 16,
                    paddingLeft: 14,
                    borderLeftWidth: 3,
                    borderLeftColor: activeField === "to" ? Colors.accent : "transparent",
                    borderBottomLeftRadius: 18,
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
                      fontSize: 13,
                    }}
                  >
                    {endBuilding?.name ?? "Choose destination"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSwap}
                  disabled={!canSwap}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    marginTop: -15,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: Colors.surface,
                    borderWidth: 1,
                    borderColor: Colors.borderMd,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: canSwap ? 1 : 0.35,
                  }}
                >
                  <Feather name="shuffle" size={12} color={Colors.muted} />
                </Pressable>
              </View>

              {/* Building list — extra padding to match the original inset */}
              <ScrollView
                ref={listRef}
                style={{ maxHeight: SCREEN_H * 0.28, marginHorizontal: 12 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {query.trim() !== "" && results.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: "center" }}>
                    <Feather name="search" size={20} color={Colors.muted} />
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
                        style={{ flex: 1, paddingVertical: 10 }}
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
                        style={{ paddingHorizontal: 8, paddingVertical: 10 }}
                      >
                        <Feather name="map-pin" size={14} color={Colors.muted} />
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Route summary + GO */}
              {showSummary && (
                <View
                  style={{
                    borderRadius: 16,
                    backgroundColor: Colors.surface,
                    borderColor: Colors.border,
                    borderWidth: 1,
                    padding: 14,
                    marginTop: 8,
                    marginHorizontal: 12,
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
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
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
                          style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}
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
                        backgroundColor: routeDistanceMeters ? Colors.accent : Colors.border,
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
          </Animated.View>
        </Animated.View>
      </BlurView>
    </View>
  );
}
