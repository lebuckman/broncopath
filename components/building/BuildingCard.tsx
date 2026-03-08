import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import type { DensityLevel } from '../../constants/mockData';
import DensityDot from '../ui/DensityDot';
import DensityBar from '../ui/DensityBar';

interface Props {
  name: string;
  code: string;
  percentage: number;
  level: DensityLevel;
  roomCount: number;
  freeCount: number;
  onPress: () => void;
}

function densityColor(level: DensityLevel): string {
  if (level === 'low') return Colors.low;
  if (level === 'med') return Colors.med;
  return Colors.high;
}

function densityLabel(level: DensityLevel): string {
  if (level === 'low') return 'LOW';
  if (level === 'med') return 'MOD';
  return 'BUSY';
}

export default function BuildingCard({
  name,
  code,
  percentage,
  level,
  roomCount,
  freeCount,
  onPress,
}: Props) {
  const color = densityColor(level);
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className="rounded-2xl p-5 border"
      style={{
        backgroundColor: pressed ? Colors.cardHover : Colors.card,
        borderColor: Colors.border,
      }}
    >
      {/* Row 1: building name + occupancy percentage */}
      <View className="flex-row justify-between items-center mb-1">
        <Text
          className="text-sm flex-1 mr-3"
          numberOfLines={1}
          style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
        >
          {name}
        </Text>
        <Text
          className="text-sm"
          style={{ color, fontFamily: Fonts.bodySemiBold }}
        >
          {percentage}%
        </Text>
      </View>

      {/* Row 2: building code + room availability */}
      <Text
        className="text-[11px] mb-3"
        style={{ color: Colors.muted, fontFamily: Fonts.body }}
      >
        {code} · {freeCount} of {roomCount} rooms free
      </Text>

      {/* Row 3: density dot + bar + status label */}
      <View className="flex-row items-center gap-2">
        <DensityDot level={level} />
        <View className="flex-1">
          <DensityBar percentage={percentage} level={level} />
        </View>
        <Text
          className="text-[10px]"
          style={{ color, fontFamily: Fonts.bodySemiBold }}
        >
          {densityLabel(level)}
        </Text>
      </View>
    </Pressable>
  );
}