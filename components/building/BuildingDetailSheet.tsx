import { useState } from "react";
import { Modal, Pressable, ScrollView, Share, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building, Room } from "../../constants/mockData";
import { useRooms } from "../../hooks/useRooms";
import { useFavorites } from "../../hooks/useFavorites";
import { roomMatchesFilter } from "../../lib/roomFilters";
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
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rooms: fetchedRooms, loading: roomsLoading } = useRooms(
    preloadedRooms ? "" : (building?.id ?? ""),
  );
  const allRooms = preloadedRooms ?? fetchedRooms;
  const { isFavorite, toggleFavorite, getFavoriteRoomIds } = useFavorites();
  const favoriteRoomIds = building ? getFavoriteRoomIds(building.id) : [];
  const [dirModalVisible, setDirModalVisible] = useState(false);

  const rooms = (() => {
    let base = allRooms;
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
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
  })();

  async function handleShare(room: Room) {
    const statusLine = room.freeUntil
      ? `🟢 Free until ${room.freeUntil}`
      : `🟢 Free`;
    const capacityStr =
      room.capacity > 0 ? `${room.capacity} seats` : "Unknown capacity";
    const message = [
      `📍 Room ${room.number} · ${building?.name} (${building?.code})`,
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

  function handleDirections(type: "from" | "to") {
    if (!building) return;
    setDirModalVisible(false);
    onClose();
    router.push({
      pathname: "/(tabs)/route",
      params: type === "from" ? { fromId: building.id } : { toId: building.id },
    });
  }

  function handleViewOnMap() {
    if (!building) return;
    setDirModalVisible(false);
    onClose();
    router.push({ pathname: "/(tabs)/map", params: { focusBuildingId: building.id } });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {building && (
        <View style={{ paddingBottom: insets.bottom + 16 }}>
          {/* Header */}
          <View
            className="px-5 pt-3 pb-4"
            style={{ borderBottomColor: Colors.border, borderBottomWidth: 1 }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
              <Text
                className="text-[22px] flex-1 mr-3"
                style={{ color: Colors.text, fontFamily: Fonts.display }}
              >
                {building.name}
              </Text>
              <Pressable onPress={() => setDirModalVisible(true)} hitSlop={8} style={{ marginTop: 4 }}>
                <Feather name="navigation" size={16} color={Colors.accent} />
              </Pressable>
            </View>

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
          </View>

          {/* Room list */}
          <View className="px-5 pt-4">
            <SectionLabel>Rooms</SectionLabel>
            {roomsLoading ? (
              <Text
                className="text-[12px] py-4"
                style={{ color: Colors.muted, fontFamily: Fonts.body }}
              >
                Loading rooms…
              </Text>
            ) : (
              <ScrollView
                style={{ maxHeight: 340 }}
                showsVerticalScrollIndicator={false}
              >
                {rooms.map((room, i) => (
                  <View
                    key={room.id}
                    className="flex-row items-center justify-between py-3"
                    style={
                      i < rooms.length - 1
                        ? {
                            borderBottomColor: Colors.border,
                            borderBottomWidth: 1,
                          }
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
                          <Text
                            style={{
                              color: Colors.muted,
                              fontFamily: Fonts.body,
                            }}
                          >
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
                        {room.capacity > 0
                          ? `${room.capacity} seats`
                          : "Unknown seats"}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <FavoriteButton
                        isFavorite={isFavorite(room.id)}
                        onToggle={() => toggleFavorite(room.id, building.id)}
                      />
                      {room.status === "free" && (
                        <Pressable
                          onPress={() => handleShare(room)}
                          hitSlop={8}
                        >
                          <Feather
                            name="share-2"
                            size={14}
                            color={Colors.accent}
                          />
                        </Pressable>
                      )}
                      {room.freesAt &&
                        (room.status === "busy" || room.status === "soon") && (
                          <CountdownTimer freesAt={room.freesAt} />
                        )}
                      <RoomBadge
                        status={room.status}
                        label={roomBadgeLabel(room)}
                      />
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* Directions from/to modal */}
      <Modal
        visible={dirModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDirModalVisible(false)}
        statusBarTranslucent
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            paddingHorizontal: 48,
          }}
          onPress={() => setDirModalVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: Colors.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: Colors.borderMd,
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                color: Colors.muted,
                fontFamily: Fonts.bodySemiBold,
                fontSize: 11,
                letterSpacing: 1,
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 12,
                textTransform: "uppercase",
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              Directions
            </Text>
            <Pressable
              onPress={() => handleDirections("from")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <Feather name="log-out" size={15} color={Colors.accent} />
              <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 14 }}>
                Route from here
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleDirections("to")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <Feather name="log-in" size={15} color={Colors.accent} />
              <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 14 }}>
                Route to here
              </Text>
            </Pressable>
            <Pressable
              onPress={handleViewOnMap}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 20,
                paddingVertical: 16,
              }}
            >
              <Feather name="map-pin" size={15} color={Colors.accent} />
              <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 14 }}>
                View on map
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </BottomSheet>
  );
}
