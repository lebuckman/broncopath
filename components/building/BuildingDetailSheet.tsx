import { Pressable, ScrollView, Share, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
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
}

function roomBadgeLabel(room: Room): string | undefined {
  if (room.status === "soon" && room.freesAt) return `Frees at ${room.freesAt}`;
  if (room.status === "free" && room.freeUntil) return `Until ${room.freeUntil}`;
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
}: Props) {
  const insets = useSafeAreaInsets();
  const { rooms: allRooms, loading: roomsLoading } = useRooms(
    building?.id ?? "",
  );
  const { isFavorite, toggleFavorite, getFavoriteRoomIds } = useFavorites();
  const favoriteRoomIds = building ? getFavoriteRoomIds(building.id) : [];

  const rooms = (() => {
    let base = allRooms;
    if (filterRoomIds) {
      // Home screen: show only the explicitly specified room IDs
      base = base.filter((r) => filterRoomIds.includes(r.id));
    } else if (activeFilters && activeFilters.length > 0) {
      // Strip "Favorites" — the detail sheet always shows all rooms for context;
      // favorites are surfaced by sorting rather than filtering
      const chipFilters = activeFilters.filter((f) => f !== "Favorites");
      if (chipFilters.length > 0) {
        base = base.filter((r) =>
          chipFilters.some((f) => roomMatchesFilter(r, f, favoriteRoomIds)),
        );
      }
    }
    // Favorites float to top, then alphabetical by room number
    return base.slice().sort((a, b) => {
      const aFav = isFavorite(a.id) ? 0 : 1;
      const bFav = isFavorite(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
  })();

  async function handleShare(room: Room) {
    try {
      await Share.share({
        message: `📍 Room ${room.number} is free right now!\nBuilding: ${building?.name}\nCapacity: ${room.capacity > 0 ? `${room.capacity} seats` : "Unknown"}\nStatus: Free\n—\nSent via BroncoPath 🐴`,
      });
    } catch {
      // user dismissed the share sheet
    }
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
            <Text
              className="text-[22px] mb-1"
              style={{ color: Colors.text, fontFamily: Fonts.display }}
            >
              {building.name}
            </Text>

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
    </BottomSheet>
  );
}
