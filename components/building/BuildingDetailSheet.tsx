import { ScrollView, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import type { Building, Room } from '../../constants/mockData';
import BottomSheet from '../ui/BottomSheet';
import DensityDot from '../ui/DensityDot';
import DensityBar from '../ui/DensityBar';
import RoomBadge from '../ui/RoomBadge';
import SectionLabel from '../ui/SectionLabel';

interface Props {
  building: Building | null;
  visible: boolean;
  onClose: () => void;
}

function roomBadgeLabel(room: Room): string {
  if (room.status === 'soon' && room.freesAt) return `Frees at ${room.freesAt}`;
  return undefined as unknown as string; // fall through to RoomBadge default
}

function densityText(level: Building['level']): string {
  if (level === 'low') return 'Quiet';
  if (level === 'med') return 'Moderate';
  return 'Busy';
}

function densityColor(level: Building['level']): string {
  if (level === 'low') return Colors.low;
  if (level === 'med') return Colors.med;
  return Colors.high;
}

export default function BuildingDetailSheet({ building, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {building && (
        <View style={{ paddingBottom: insets.bottom + 16 }}>
          {/* Header */}
          <View className="px-5 pt-3 pb-4" style={{ borderBottomColor: Colors.border, borderBottomWidth: 1 }}>
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
                {building.code} · {' '}
                <Text style={{ color: densityColor(building.level) }}>
                  {densityText(building.level)}
                </Text>
              </Text>
            </View>

            <DensityBar percentage={building.occupancy} level={building.level} />
            <View className="flex-row justify-between mt-1.5">
              <Text
                className="text-[11px]"
                style={{ color: Colors.muted, fontFamily: Fonts.body }}
              >
                Occupancy
              </Text>
              <Text
                className="text-[11px]"
                style={{ color: densityColor(building.level), fontFamily: Fonts.bodySemiBold }}
              >
                {building.occupancy}%
              </Text>
            </View>
          </View>

          {/* Room list */}
          <View className="px-5 pt-4">
            <SectionLabel>Rooms</SectionLabel>
            <ScrollView
              style={{ maxHeight: 340 }}
              showsVerticalScrollIndicator={false}
            >
              {building.rooms.map((room, i) => (
                <View
                  key={room.id}
                  className="flex-row items-center justify-between py-3"
                  style={i < building.rooms.length - 1
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
                      {room.type} · {room.capacity} seats
                    </Text>
                  </View>
                  <RoomBadge
                    status={room.status}
                    label={room.status === 'soon' ? roomBadgeLabel(room) : undefined}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}