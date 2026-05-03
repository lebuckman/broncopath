import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  UIManager,
  Pressable,
  Share,
  View,
  Text,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Room } from "../../constants/mockData";
import { useFavorites } from "../../hooks/useFavorites";
import FavoriteButton from "../ui/FavoriteButton";
import RoomBadge from "../ui/RoomBadge";
import CountdownTimer from "../ui/CountdownTimer";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  buildingId: string;
  name: string;
  code: string;
  freeCount: number;
  rooms: Room[];
  forceExpanded?: boolean;
}

export default function BuildingAccordion({
  buildingId,
  name,
  code,
  freeCount,
  rooms,
  forceExpanded,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const isExpanded = expanded || !!forceExpanded;

  async function handleShare(room: Room) {
    const statusLine = room.freeUntil
      ? `🟢 Free until ${room.freeUntil}`
      : `🟢 Free`;
    const capacityStr =
      room.capacity > 0 ? `${room.capacity} seats` : "Unknown capacity";
    const message = [
      `📍 Room ${room.number} · ${name} (${code})`,
      `🪑 ${capacityStr} · ${room.type}`,
      statusLine,
      `—`,
      `Sent via BroncoPath 🐴`,
    ].join("\n");
    try {
      await Share.share({ message });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }

  return (
    <View
      className="mb-2.5 rounded-2xl overflow-hidden border"
      style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
    >
      {/* Header */}
      <Pressable
        className="flex-row items-center justify-between p-5"
        onPress={toggle}
      >
        <View className="flex-1 mr-3">
          <Text
            className="text-sm mb-0.5"
            numberOfLines={1}
            style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
          >
            {name}
          </Text>
          <Text
            className="text-[11px]"
            style={{ color: Colors.muted, fontFamily: Fonts.body }}
          >
            {code} · {freeCount} of {rooms.length} free
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {freeCount > 0 && (
            <View>
              <Text
                className="text-sm"
                style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold }}
              >
                {freeCount} free
              </Text>
            </View>
          )}
          <Feather
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.muted}
          />
        </View>
      </Pressable>

      {/* Room rows */}
      {isExpanded && (
        <View
          style={{
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            backgroundColor: Colors.surface,
          }}
        >
          {rooms.map((room, i) => (
            <View
              key={room.id}
              className="flex-row items-center justify-between px-5 py-3"
              style={
                i < rooms.length - 1
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
                  onToggle={() => toggleFavorite(room.id, buildingId)}
                />
                {room.status === "free" && (
                  <Pressable onPress={() => handleShare(room)} hitSlop={8}>
                    <Feather name="share-2" size={14} color={Colors.accent} />
                  </Pressable>
                )}
                {room.freesAt &&
                  (room.status === "busy" || room.status === "soon") && (
                    <CountdownTimer freesAt={room.freesAt} />
                  )}
                <RoomBadge
                  status={room.status}
                  label={
                    room.status === "soon" && room.freesAt
                      ? `Frees at ${room.freesAt}`
                      : room.status === "free" && room.freeUntil
                        ? `Until ${room.freeUntil}`
                        : undefined
                  }
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
