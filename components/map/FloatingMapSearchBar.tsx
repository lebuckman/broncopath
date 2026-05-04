import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";

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
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterLabel = useMemo(() => {
    if (activeFilters.length === 0) return "Filters";
    if (activeFilters.length === 1) return activeFilters[0];
    return `${activeFilters.length} filters`;
  }, [activeFilters]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 600,
        left: 16,
        right: 16,
        zIndex: 20,
      }}
    >
      <BlurView
        intensity={42}
        tint="dark"
        style={{
          borderRadius: 28,
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
            padding: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pressable
              onPress={onFocusSearch}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.08)",
                borderColor: Colors.border,
                borderWidth: 1,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Feather name="search" size={18} color={Colors.accent} />

              <TextInput
                editable={false}
                pointerEvents="none"
                value=""
                placeholder="Search buildings or plan a journey"
                placeholderTextColor={Colors.muted}
                style={{
                  flex: 1,
                  color: Colors.text,
                  fontFamily: Fonts.bodyMedium,
                  fontSize: 14,
                  padding: 0,
                }}
              />
            </Pressable>

            <Pressable
              onPress={() => setFiltersOpen((prev) => !prev)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  filtersOpen || activeFilters.length > 0
                    ? Colors.accentBg
                    : "rgba(255,255,255,0.08)",
                borderColor:
                  filtersOpen || activeFilters.length > 0
                    ? Colors.accent
                    : Colors.border,
                borderWidth: 1,
              }}
            >
              <Feather
                name="sliders"
                size={18}
                color={
                  filtersOpen || activeFilters.length > 0
                    ? Colors.accent
                    : Colors.text
                }
              />
            </Pressable>
          </View>

          {filtersOpen && (
            <View style={{ paddingTop: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    color: Colors.text,
                    fontFamily: Fonts.bodySemiBold,
                    fontSize: 14,
                  }}
                >
                  {activeFilterLabel}
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
                      paddingVertical: 6,
                      backgroundColor:
                        filterMode === "any"
                          ? Colors.accentBg
                          : "transparent",
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
                      paddingVertical: 6,
                      backgroundColor:
                        filterMode === "all"
                          ? Colors.accentBg
                          : "transparent",
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
            </View>
          )}
        </View>
      </BlurView>
    </View>
  );
}