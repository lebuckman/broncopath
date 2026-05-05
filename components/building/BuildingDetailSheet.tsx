import { ActivityIndicator, Animated, Pressable, ScrollView, Share, View, Text } from "react-native";
import { useRef, useEffect } from "react";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building, Room } from "../../constants/mockData";
import { useRooms } from "../../hooks/useRooms";
import { useFavorites } from "../../hooks/useFavorites";
import { roomMatchesFilter } from "../../lib/roomFilters";
import type { BuildingSection } from "../../lib/buildingGroups";
import BottomSheet from "../ui/BottomSheet";
import DensityDot from "../ui/DensityDot";
import DensityBar from "../ui/DensityBar";
import FavoriteButton from "../ui/FavoriteButton";
import RoomBadge from "../ui/RoomBadge";
import CountdownTimer from "../ui/CountdownTimer";
import SectionLabel from "../ui/SectionLabel";

interface Props {
  building: Building | null;
  visible: boolean;
  onClose: () => void;
  activeFilters?: string[];
  filterRoomIds?: string[];
  preloadedRooms?: Room[];
  sections?: BuildingSection[];
}

function roomBadgeLabel(room: Room): string | undefined {
  if (room.status === "soon" && room.freesAt) return `Free at ${room.freesAt}`;
  if (room.status === "free" && room.freeUntil)
    return `Until ${room.freeUntil}`;
  return undefined;
}

function densityText(level: Building["level"]): string {
  if (level === "low") return "Quiet";
  if (level === "med") return "Moderate";
  return "Busy";
}

function densityColor(level: Building["level"]): string {
  if (level === "low") return Colors.low;
  if (level === "med") return Colors.med;
  return Colors.high;
}

export default function BuildingDetailSheet({
  building,
  visible,
  onClose,
  activeFilters,
  filterRoomIds,
  preloadedRooms,
  sections,
}: Props) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!building) return;
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [building?.id]);

  const { rooms: fetchedRooms, loading: roomsLoading } = useRooms(
    preloadedRooms || sections ? "" : (building?.id ?? ""),
  );
  const allRooms = preloadedRooms ?? (sections ? sections.flatMap((s) => s.rooms) : fetchedRooms);
  const groupRoomCount = sections
    ? sections.reduce((sum, s) => sum + s.rooms.length, 0)
    : building?.roomCount ?? 0;
  const { isFavorite, toggleFavorite, getFavoriteRoomIds } = useFavorites();
  const favoriteRoomIds = building ? getFavoriteRoomIds(building.id) : [];

  const rooms = filterAndSortRooms(allRooms);

  async function handleShare(room: Room, shareBuilding?: Building) {
    const bldg = shareBuilding ?? building;
    const statusLine = room.freeUntil
      ? `🟢 Free until ${room.freeUntil}`
      : `🟢 Free`;
    const capacityStr =
      room.capacity > 0 ? `${room.capacity} seats` : "Unknown capacity";
    const message = [
      `📍 Room ${room.number} · ${bldg?.name} (${bldg?.code})`,
      `🪑 ${capacityStr} · ${room.type}`,
      statusLine,
      `—`,
      `Sent via BroncoPath 🐴`,
    ].join("\n");
    try {
      await Share.share({ message });
    } catch {
      // user dismissed the share sheet
    }
  }

  function filterAndSortRooms(roomList: Room[]): Room[] {
    let base = roomList;
    if (filterRoomIds) {
      base = base.filter((r) => filterRoomIds.includes(r.id));
    } else if (activeFilters && activeFilters.length > 0) {
      const chipFilters = activeFilters.filter((f) => f !== "Favorites");
      if (chipFilters.length > 0) {
        base = base.filter((r) =>
          chipFilters.some((f) => roomMatchesFilter(r, f, favoriteRoomIds)),
        );
      }
    }
    return base.slice().sort((a, b) => {
      const aFav = isFavorite(a.id) ? 0 : 1;
      const bFav = isFavorite(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return (a.number ?? "").localeCompare(b.number ?? "", undefined, {
        numeric: true,
      });
    });
  }

  function renderRoomRow(room: Room, isLast: boolean, shareBuilding?: Building) {
    return (
      <View
        key={room.id}
        className="flex-row items-center justify-between py-3"
        style={
          !isLast
            ? { borderBottomColor: Colors.border, borderBottomWidth: 1 }
            : undefined
        }
      >
        <View className="flex-1 mr-3">
          <Text
            className="text-[13px] mb-0.5"
            style={{ color: Colors.text, fontFamily: Fonts.mono }}
          >
            {room.number}
            {room.courseName ? (
              <Text style={{ color: Colors.muted, fontFamily: Fonts.body }}>
                {" "}
                ({room.courseName.replace(/\s+/g, "")})
              </Text>
            ) : null}
          </Text>
          <Text
            className="text-[11px]"
            style={{ color: Colors.muted, fontFamily: Fonts.body }}
          >
            {room.type} ·{" "}
            {room.capacity > 0 ? `${room.capacity} seats` : "Unknown seats"}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <FavoriteButton
            isFavorite={isFavorite(room.id)}
            onToggle={() => toggleFavorite(room.id, building!.id)}
          />
          {room.status === "free" && (
            <Pressable
              onPress={() => handleShare(room, shareBuilding)}
              hitSlop={8}
            >
              <Feather name="share-2" size={14} color={Colors.accent} />
            </Pressable>
          )}
          {room.freesAt &&
            (room.status === "busy" || room.status === "soon") && (
              <CountdownTimer freesAt={room.freesAt} />
            )}
          <RoomBadge status={room.status} label={roomBadgeLabel(room)} />
        </View>
      </View>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {building && (
        <Animated.View style={{ paddingBottom: insets.bottom + 16, opacity: fadeAnim }}>
          {groupRoomCount === 0 ? (
            /* No-classroom buildings: simple header, no occupancy/rooms */
            <View className="px-5 pt-3 pb-6">
              <Text
                className="text-[22px] mb-1"
                style={{ color: Colors.text, fontFamily: Fonts.display }}
              >
                {building.name}
              </Text>
              <Text
                className="text-[12px] mb-6"
                style={{ color: Colors.muted, fontFamily: Fonts.body }}
              >
                {building.code}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: Colors.surface,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <Feather name="map-pin" size={16} color={Colors.muted} />
                <Text
                  style={{
                    color: Colors.muted,
                    fontFamily: Fonts.body,
                    fontSize: 13,
                  }}
                >
                  No classrooms in this building
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* Header */}
              <View
                className="px-5 pt-3 pb-4"
                style={{ borderBottomColor: Colors.border, borderBottomWidth: 1 }}
              >
                <Text
                  className="text-[22px] mb-1"
                  style={{ color: Colors.text, fontFamily: Fonts.display }}
                >
                  {building.name}
                </Text>

                {building.roomCount > 0 ? (
                  <>
                    <View className="flex-row items-center gap-2 mb-4">
                      <DensityDot level={building.level} />
                      <Text
                        className="text-[12px]"
                        style={{ color: Colors.muted, fontFamily: Fonts.body }}
                      >
                        {building.code} ·{" "}
                        <Text style={{ color: densityColor(building.level) }}>
                          {densityText(building.level)}
                        </Text>
                      </Text>
                    </View>
                    <DensityBar
                      percentage={building.occupancy}
                      level={building.level}
                    />
                    <View className="flex-row justify-between mt-1.5">
                      <Text
                        className="text-[11px]"
                        style={{ color: Colors.muted, fontFamily: Fonts.body }}
                      >
                        Occupancy
                      </Text>
                      <Text
                        className="text-[11px]"
                        style={{
                          color: densityColor(building.level),
                          fontFamily: Fonts.bodySemiBold,
                        }}
                      >
                        {building.occupancy}%
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text
                    className="text-[12px]"
                    style={{ color: Colors.muted, fontFamily: Fonts.body }}
                  >
                    {building.code}
                  </Text>
                )}
              </View>

              {/* Room list */}
              <View className="px-5 pt-4">
                <SectionLabel>Rooms</SectionLabel>
                {roomsLoading ? (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={Colors.accent} />
                  </View>
                ) : (
                  <ScrollView
                    style={{ maxHeight: 340 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {sections && sections.length > 1 ? (
                      sections.map((section, si) => {
                        const sectionRooms = filterAndSortRooms(section.rooms);
                        const hasDbRooms = section.rooms.length > 0;
                        if (!hasDbRooms) {
                          return (
                            <View key={section.building.id}>
                              <View
                                style={{
                                  paddingTop: si === 0 ? 0 : 12,
                                  paddingBottom: 6,
                                  borderTopWidth: si === 0 ? 0 : 1,
                                  borderTopColor: Colors.border,
                                }}
                              >
                                <Text
                                  style={{
                                    color: Colors.muted,
                                    fontSize: 10,
                                    fontFamily: Fonts.bodySemiBold,
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  {section.building.code}
                                </Text>
                              </View>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 6,
                                  paddingBottom: 8,
                                }}
                              >
                                <Feather
                                  name="map-pin"
                                  size={12}
                                  color={Colors.muted}
                                />
                                <Text
                                  style={{
                                    color: Colors.muted,
                                    fontFamily: Fonts.body,
                                    fontSize: 12,
                                  }}
                                >
                                  No classrooms
                                </Text>
                              </View>
                            </View>
                          );
                        }
                        if (sectionRooms.length === 0) return null;
                        return (
                          <View key={section.building.id}>
                            <View
                              style={{
                                paddingTop: si === 0 ? 0 : 12,
                                paddingBottom: 6,
                                borderTopWidth: si === 0 ? 0 : 1,
                                borderTopColor: Colors.border,
                              }}
                            >
                              <Text
                                style={{
                                  color: Colors.muted,
                                  fontSize: 10,
                                  fontFamily: Fonts.bodySemiBold,
                                  letterSpacing: 0.5,
                                }}
                              >
                                {section.building.code}
                              </Text>
                            </View>
                            {sectionRooms.map((room, i) =>
                              renderRoomRow(
                                room,
                                i === sectionRooms.length - 1,
                                section.building,
                              ),
                            )}
                          </View>
                        );
                      })
                    ) : (
                      rooms.map((room, i) =>
                        renderRoomRow(room, i === rooms.length - 1),
                      )
                    )}
                  </ScrollView>
                )}
              </View>
            </>
          )}
        </Animated.View>
      )}
    </BottomSheet>
  );
}
