import { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Room } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import { getRooms } from "../../lib/api";
import BuildingAccordion from "../../components/building/BuildingAccordion";
import BuildingAccordionSkeleton from "../../components/building/BuildingAccordionSkeleton";
import ChipFilter from "../../components/ui/ChipFilter";

const FILTER_OPTIONS = ["All", "Free Now", "Study Rooms", "Labs"];

function roomMatchesFilters(room: Room, filters: string[]): boolean {
  return filters.every((f) => {
    if (f === "Free Now") return room.status === "free";
    if (f === "Study Rooms")
      return (
        room.type.includes("Study") ||
        room.type === "Quiet Zone" ||
        room.type === "Group Room"
      );
    if (f === "Labs") return room.type.includes("Lab");
    return true;
  });
}

export default function RoomsScreen() {
  const { buildings, loading, error } = useBuildings();
  const [roomsMap, setRoomsMap] = useState<Record<string, Room[]>>({});
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    buildings.forEach((b) => {
      getRooms(b.id).then((rooms) => {
        setRoomsMap((prev) => ({ ...prev, [b.id]: rooms }));
      });
    });
  }, [buildings]);

  const trimmed = query.trim().toLowerCase();

  const filteredBuildings = buildings
    .map((b) => {
      const allRooms = roomsMap[b.id] ?? [];
      const buildingMatches =
        trimmed === "" ||
        b.name.toLowerCase().includes(trimmed) ||
        b.code.toLowerCase().includes(trimmed);

      let rooms: Room[];
      if (trimmed !== "" && !buildingMatches) {
        // Search mode: show only rooms whose number matches
        rooms = allRooms.filter((r) =>
          r.number.toLowerCase().includes(trimmed),
        );
      } else {
        rooms =
          activeFilters.length === 0
            ? allRooms
            : allRooms.filter((r) => roomMatchesFilters(r, activeFilters));
      }

      return {
        ...b,
        rooms,
        freeCount: rooms.filter((r: Room) => r.status === "free").length,
      };
    })
    .filter((b) => {
      if (trimmed !== "")
        return (
          b.rooms.length > 0 ||
          b.name.toLowerCase().includes(trimmed) ||
          b.code.toLowerCase().includes(trimmed)
        );
      return (
        activeFilters.length === 0 || !roomsMap[b.id] || b.rooms.length > 0
      );
    });

  const totalFree = filteredBuildings.reduce(
    (sum: number, b) => sum + b.freeCount,
    0,
  );

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
            {totalFree} rooms available right now
          </Text>
        </View>

        {/* Search bar */}
        <View
          className="mx-5 mb-2 flex-row items-center rounded-xl border px-3"
          style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
        >
          <Feather name="search" size={14} color={Colors.muted} />
          <TextInput
            className="flex-1 py-2.5 pl-2 text-[13px]"
            style={{ color: Colors.text, fontFamily: Fonts.body }}
            placeholder="Search buildings or rooms…"
            placeholderTextColor={Colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        <ChipFilter
          options={FILTER_OPTIONS}
          active={activeFilters}
          onChange={setActiveFilters}
        />

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
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredBuildings.length === 0 ? (
              <View className="items-center justify-center pt-16">
                <Text
                  className="text-[15px] mb-1"
                  style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
                >
                  No results
                </Text>
                <Text
                  className="text-[12px] text-center"
                  style={{ color: Colors.muted, fontFamily: Fonts.body }}
                >
                  {trimmed !== ""
                    ? "Try a different search"
                    : "Try removing a filter"}
                </Text>
              </View>
            ) : (
              filteredBuildings.map((b) => (
                <BuildingAccordion
                  key={b.id}
                  name={b.name}
                  code={b.code}
                  freeCount={b.freeCount}
                  rooms={b.rooms}
                />
              ))
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
