import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import type { RouteOption, DensityLevel } from '../../constants/mockData';
import DensityDot from '../ui/DensityDot';

interface Props {
  route: RouteOption;
  selected: boolean;
  onPress: () => void;
}

function crowdColor(level: DensityLevel): string {
  if (level === 'low') return Colors.low;
  if (level === 'med') return Colors.med;
  return Colors.high;
}

function crowdLabel(level: DensityLevel): string {
  if (level === 'low') return 'Low crowd';
  if (level === 'med') return 'Moderate';
  return 'High crowd';
}

export default function RouteOptionCard({ route, selected, onPress }: Props) {
  const [pressed, setPressed] = useState(false);
  const isRecommended = route.type === 'recommended';

  const cardBg = pressed
    ? Colors.cardHover
    : selected && isRecommended
    ? Colors.accentBg
    : selected
    ? Colors.cardHover
    : Colors.card;
  const cardBorder = selected
    ? isRecommended ? Colors.accentBorder : Colors.borderMd
    : Colors.border;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className="rounded-2xl border p-5 mb-2.5"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      {/* Tag + check */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">
          <Feather
            name={isRecommended ? 'star' : 'zap'}
            size={11}
            color={isRecommended ? Colors.accent : Colors.muted}
          />
          <Text
            className="text-[11px]"
            style={{
              color: isRecommended ? Colors.accent : Colors.muted,
              fontFamily: Fonts.bodySemiBold,
            }}
          >
            {isRecommended ? 'Recommended' : 'Fastest'}
          </Text>
        </View>
        {selected && (
          <Feather
            name="check-circle"
            size={15}
            color={isRecommended ? Colors.accent : Colors.borderMd}
          />
        )}
      </View>

      {/* Title */}
      <Text className="text-sm mb-3" style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}>
        {route.title}
      </Text>

      {/* Stats row */}
      <View className="flex-row gap-4">
        <View className="flex-row items-center gap-1">
          <Feather name="clock" size={12} color={Colors.muted} />
          <Text className="text-[12px]" style={{ color: Colors.text, fontFamily: Fonts.body }}>
            {route.walkMinutes} min
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <DensityDot level={route.crowdLevel} />
          <Text
            className="text-[12px]"
            style={{ color: crowdColor(route.crowdLevel), fontFamily: Fonts.body }}
          >
            {crowdLabel(route.crowdLevel)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Feather name="map-pin" size={12} color={Colors.muted} />
          <Text className="text-[12px]" style={{ color: Colors.text, fontFamily: Fonts.body }}>
            {route.distanceM}m
          </Text>
        </View>
      </View>

      {/* Steps — shown only when selected */}
      {selected && (
        <View
          className="mt-3 pt-3"
          style={{ borderTopColor: Colors.border, borderTopWidth: 1 }}
        >
          {route.steps.map((step, i) => (
            <View key={i} className="flex-row items-start gap-2 mb-1.5">
              <Text
                className="text-[11px] mt-0.5 w-4"
                style={{ color: Colors.muted, fontFamily: Fonts.mono }}
              >
                {i + 1}.
              </Text>
              <Text
                className="text-[12px] flex-1"
                style={{ color: Colors.muted, fontFamily: Fonts.body }}
              >
                {step.instruction}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}