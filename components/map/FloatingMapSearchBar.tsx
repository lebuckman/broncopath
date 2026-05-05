import { useRef, useEffect, useMemo, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import GroupedChipFilter from "../ui/GroupedChipFilter";
import type { FilterMode } from "../../lib/roomFilters";

type Props = {
  activeFilters: string[];
  filterMode: FilterMode;
  showFavorites: boolean;
  onChangeFilters: (filters: string[]) => void;
  onChangeFilterMode: (mode: FilterMode) => void;
  onFocusSearch: () => void;
};

export default function FloatingMapSearchBar({
  activeFilters,
  filterMode,
  showFavorites,
  onChangeFilters,
  onChangeFilterMode,
  onFocusSearch,
}: Props) {
  const insets = useSafeAreaInsets();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (filtersOpen) {
      setFiltersVisible(true);
      Animated.timing(filterAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(filterAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => setFiltersVisible(false));
    }
  }, [filtersOpen]);

  const filterLabel = useMemo(() => {
    if (activeFilters.length === 0) return "Filters";
    if (activeFilters.length === 1) return activeFilters[0];
    return `${activeFilters.length} active`;
  }, [activeFilters]);

  const hasActive = filtersOpen || activeFilters.length > 0;

  const filterTranslate = filterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 20,
        left: 16,
        right: 16,
        zIndex: 20,
      }}
    >
      {/* Filter panel — animated, renders above the bar */}
      {filtersVisible && (
        <Animated.View
          style={{
            opacity: filterAnim,
            transform: [{ translateY: filterTranslate }],
            marginBottom: 8,
          }}
        >
          <BlurView
            intensity={42}
            tint="dark"
            style={{
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: Colors.border,
              backgroundColor: "rgba(20, 24, 31, 0.72)",
              shadowColor: "#000",
              shadowOpacity: 0.28,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 4 },
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
                style={{
                  color: Colors.text,
                  fontFamily: Fonts.bodySemiBold,
                  fontSize: 13,
                }}
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
                    backgroundColor:
                      filterMode === "any" ? Colors.accentBg : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: Fonts.bodyMedium,
                      color:
                        filterMode === "any" ? Colors.accent : Colors.muted,
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
                    backgroundColor:
                      filterMode === "all" ? Colors.accentBg : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: Fonts.bodyMedium,
                      color:
                        filterMode === "all" ? Colors.accent : Colors.muted,
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

      {/* Main bar */}
      <BlurView
        intensity={42}
        tint="dark"
        style={{
          borderRadius: 26,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: Colors.border,
          backgroundColor: "rgba(20, 24, 31, 0.72)",
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 8,
          }}
        >
          {/* Search pill */}
          <Pressable
            onPress={onFocusSearch}
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
            <Feather name="search" size={16} color={Colors.muted} />
            <Text
              style={{
                flex: 1,
                color: Colors.muted,
                fontFamily: Fonts.body,
                fontSize: 13,
              }}
              numberOfLines={1}
            >
              Search buildings or plan a route
            </Text>
          </Pressable>

          {/* Filter button */}
          <Pressable
            onPress={() => setFiltersOpen((prev) => !prev)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: hasActive
                ? Colors.accentBg
                : "rgba(255,255,255,0.07)",
              borderColor: hasActive ? Colors.accent : Colors.border,
              borderWidth: 1,
            }}
          >
            <Feather
              name="sliders"
              size={16}
              color={hasActive ? Colors.accent : Colors.text}
            />
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}
