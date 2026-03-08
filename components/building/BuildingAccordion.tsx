import { useState } from 'react';
import { LayoutAnimation, Platform, UIManager, Pressable, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import type { Room } from '../../constants/mockData';
import RoomBadge from '../ui/RoomBadge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  name: string;
  code: string;
  freeCount: number;
  rooms: Room[];
}

export default function BuildingAccordion({ name, code, freeCount, rooms }: Props) {
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }

  return (
    <View
      className="mb-2.5 rounded-2xl overflow-hidden border"
      style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
    >
      {/* Header */}
      <Pressable className="flex-row items-center justify-between p-5" onPress={toggle}>
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
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
        </View>
      </Pressable>

      {/* Room rows */}
      {expanded && (
        <View style={{ borderTopColor: Colors.border, borderTopWidth: 1, backgroundColor: Colors.surface }}>
          {rooms.map((room, i) => (
            <View
              key={room.id}
              className="flex-row items-center justify-between px-5 py-3"
              style={i < rooms.length - 1 ? { borderBottomColor: Colors.border, borderBottomWidth: 1 } : undefined}
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
                  {room.type} · {room.capacity} seats
                </Text>
              </View>
              <RoomBadge
                status={room.status}
                label={room.status === 'soon' && room.freesAt ? `Frees at ${room.freesAt}` : undefined}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}