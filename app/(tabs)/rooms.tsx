import { useState, useEffect } from "react";
import { ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

  useEffect(() => {
    buildings.forEach((b) => {
      getRooms(b.id).then((rooms) => {
        setRoomsMap((prev) => ({ ...prev, [b.id]: rooms }));
      });
    });
  }, [buildings]);

  const filteredBuildings = buildings
    .map((b) => {
      const allRooms = roomsMap[b.id] ?? [];
      const rooms =
        activeFilters.length === 0
          ? allRooms
          : allRooms.filter((r: Room) => roomMatchesFilters(r, activeFilters));
      return {
        ...b,
        rooms,
        freeCount: rooms.filter((r: Room) => r.status === "free").length,
      };
    })
    .filter(
      (b) =>
        activeFilters.length === 0 || !roomsMap[b.id] || b.rooms.length > 0,
    );

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

      <ChipFilter
        options={FILTER_OPTIONS}
        active={activeFilters}
        onChange={setActiveFilters}
      />

      {loading ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {[...Array(8)].map((_, i) => <BuildingAccordionSkeleton key={i} />)}
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
        >
          {filteredBuildings.length === 0 && activeFilters.length > 0 ? (
            <View className="items-center justify-center pt-16">
              <Text
                className="text-[15px] mb-1"
                style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
              >
                No rooms match
              </Text>
              <Text
                className="text-[12px] text-center"
                style={{ color: Colors.muted, fontFamily: Fonts.body }}
              >
                Try removing a filter
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
    </SafeAreaView>
  );
}
