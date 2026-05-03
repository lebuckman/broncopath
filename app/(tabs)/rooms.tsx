import { useState, useEffect, useRef, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Room } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import { useFavorites } from "../../hooks/useFavorites";
import { getRooms } from "../../lib/api";
import { getCachedBuildings, getCachedRooms } from "../../lib/dataCache";
import {
  FILTER_OPTIONS,
  applyRoomFilters,
  type FilterMode,
} from "../../lib/roomFilters";
import BuildingAccordion from "../../components/building/BuildingAccordion";
import BuildingAccordionSkeleton from "../../components/building/BuildingAccordionSkeleton";
import ChipFilter from "../../components/ui/ChipFilter";

type SearchMode = "buildings" | "rooms";

export default function RoomsScreen() {
  const { collapseAll } = useLocalSearchParams<{ collapseAll?: string }>();
  const { buildings, loading, error, refresh } = useBuildings();
  const [refreshing, setRefreshing] = useState(false);
  const { favorites } = useFavorites();
  const [roomsMap, setRoomsMap] = useState<Record<string, Room[]>>(() => {
    const map: Record<string, Room[]> = {};
    getCachedBuildings().forEach((b) => {
      map[b.id] = getCachedRooms(b.id);
    });
    return map;
  });
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("any");
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("buildings");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (collapseAll) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [collapseAll]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([
      refresh(),
      ...buildings.map((b) =>
        getRooms(b.id).then((rooms) =>
          setRoomsMap((prev) => ({ ...prev, [b.id]: rooms })),
        ),
      ),
    ]);
    setRefreshing(false);
  }

  const buildingIds = buildings.map((b) => b.id).join(",");

  useEffect(() => {
    if (!buildingIds) return;

    function fetchAllRooms() {
      buildings.forEach((b) => {
        getRooms(b.id).then((rooms) => {
          setRoomsMap((prev) => ({ ...prev, [b.id]: rooms }));
        });
      });
    }

    fetchAllRooms();
    const id = setInterval(fetchAllRooms, 60_000);
    return () => clearInterval(id);
  }, [buildingIds]);

  useEffect(() => {
    if (favorites.length === 0 && activeFilters.includes("Favorites")) {
      setActiveFilters((prev) => prev.filter((f) => f !== "Favorites"));
    }
  }, [favorites]);

  const favoriteIds = useMemo(
    () => favorites.map((f) => f.roomId),
    [favorites],
  );

  const filterOptions = useMemo(
    () =>
      favorites.length > 0
        ? ["All", "Favorites", ...FILTER_OPTIONS.slice(1)]
        : FILTER_OPTIONS,
    [favorites.length],
  );

  const trimmed = query.trim().toLowerCase();

  const filteredBuildings = useMemo(() => {
    return buildings
      .map((b) => {
        const allRooms = roomsMap[b.id] ?? [];

        const chipFiltered =
          activeFilters.length === 0
            ? allRooms
            : allRooms.filter((r) =>
                applyRoomFilters(r, activeFilters, filterMode, favoriteIds),
              );

        let rooms: Room[];
        if (trimmed === "") {
          rooms = chipFiltered;
        } else if (searchMode === "buildings") {
          const buildingMatches =
            b.name.toLowerCase().includes(trimmed) ||
            b.code.toLowerCase().includes(trimmed);
          rooms = buildingMatches ? chipFiltered : [];
        } else {
          rooms = chipFiltered.filter(
            (r) =>
              r.number.toLowerCase().includes(trimmed) ||
              r.type.toLowerCase().includes(trimmed),
          );
        }

        const sortedRooms = rooms
          .slice()
          .sort((a, b) =>
            a.number.localeCompare(b.number, undefined, { numeric: true }),
          );

        return {
          ...b,
          rooms: sortedRooms,
          freeCount: sortedRooms.filter((r: Room) => r.status === "free")
            .length,
        };
      })
      .filter((b) => b.rooms.length > 0)
      .sort((a, b) => {
        const numA = parseInt(a.code.replace(/\D/g, ""), 10);
        const numB = parseInt(b.code.replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.code.localeCompare(b.code);
      });
  }, [
    buildings,
    roomsMap,
    activeFilters,
    filterMode,
    favoriteIds,
    trimmed,
    searchMode,
  ]);

  const totalRooms = filteredBuildings.reduce((s, b) => s + b.rooms.length, 0);
  const totalBuildings = filteredBuildings.length;

  function renderAccordion(b: (typeof filteredBuildings)[number]) {
    return (
      <BuildingAccordion
        key={b.id + (collapseAll ?? "")}
        buildingId={b.id}
        name={b.name}
        code={b.code}
        freeCount={b.freeCount}
        rooms={b.rooms}
        forceExpanded={
          (searchMode === "rooms" && trimmed.length > 0) ||
          activeFilters.includes("Favorites")
        }
      />
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1"
      style={{ backgroundColor: Colors.bg }}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-4">
          <Text
            className="text-[26px]"
            style={{ color: Colors.text, fontFamily: Fonts.display }}
          >
            Find a Room
          </Text>
          <Text
            className="text-[12px] mt-1"
            style={{ color: Colors.muted, fontFamily: Fonts.body }}
          >
            {loading
              ? "Loading rooms…"
              : `${totalRooms} room${totalRooms !== 1 ? "s" : ""} across ${totalBuildings} building${totalBuildings !== 1 ? "s" : ""}`}
          </Text>
        </View>

        {/* Search bar with inline mode toggle */}
        <View
          className="mx-5 flex-row items-center rounded-xl border px-3"
          style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
        >
          <Feather name="search" size={14} color={Colors.muted} />
          <TextInput
            className="flex-1 py-2.5 pl-2 text-[13px]"
            style={{ color: Colors.text, fontFamily: Fonts.body }}
            placeholder={
              searchMode === "buildings"
                ? "Search buildings…"
                : "Search rooms by number or type…"
            }
            placeholderTextColor={Colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <View
            style={{
              flexDirection: "row",
              backgroundColor: Colors.surface,
              borderRadius: 6,
              overflow: "hidden",
              marginLeft: 6,
            }}
          >
            <Pressable
              onPress={() => setSearchMode("buildings")}
              style={{
                paddingHorizontal: 7,
                paddingVertical: 4,
                backgroundColor:
                  searchMode === "buildings" ? Colors.accentBg : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: Fonts.bodyMedium,
                  color:
                    searchMode === "buildings" ? Colors.accent : Colors.muted,
                }}
              >
                Bldg
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSearchMode("rooms")}
              style={{
                paddingHorizontal: 7,
                paddingVertical: 4,
                backgroundColor:
                  searchMode === "rooms" ? Colors.accentBg : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: Fonts.bodyMedium,
                  color: searchMode === "rooms" ? Colors.accent : Colors.muted,
                }}
              >
                Room
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Chip filter */}
        <View className="my-3">
          <ChipFilter
            options={filterOptions}
            active={activeFilters}
            onChange={setActiveFilters}
          />
        </View>

        {/* Filter count + Any/All toggle — always visible */}
        <View
          style={{
            height: 28,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 20,
            marginBottom: 4,
          }}
        >
          <Text
            style={{
              color: Colors.muted,
              fontSize: 11,
              fontFamily: Fonts.body,
            }}
          >
            {activeFilters.length === 0
              ? "No filters applied"
              : activeFilters.length === 1
                ? "1 Filter"
                : `${activeFilters.length} Filters`}
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

        {loading ? (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          >
            {[...Array(8)].map((_, i) => (
              <BuildingAccordionSkeleton key={i} />
            ))}
          </ScrollView>
        ) : error ? (
          <View className="flex-1 items-center justify-center">
            <Text
              className="text-[13px] mb-1"
              style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
            >
              Couldn't load rooms
            </Text>
            <Text
              className="text-[12px]"
              style={{ color: Colors.muted, fontFamily: Fonts.body }}
            >
              Check your connection and try again
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.accent}
              />
            }
          >
            {filteredBuildings.length === 0 ? (
              <View className="items-center justify-center pt-16">
                <Feather
                  name="inbox"
                  size={32}
                  color={Colors.muted}
                  style={{ marginBottom: 12 }}
                />
                <Text
                  style={{
                    color: Colors.text,
                    fontFamily: Fonts.bodyMedium,
                    fontSize: 15,
                    marginBottom: 4,
                  }}
                >
                  No rooms match your filters
                </Text>
                <Text
                  style={{
                    color: Colors.muted,
                    fontFamily: Fonts.body,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  Try adjusting your search or filters
                </Text>
              </View>
            ) : (
              filteredBuildings.map(renderAccordion)
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
