import { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

interface Props {
  updatedAt: string; // ISO timestamp
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export default function NowPill({ updatedAt }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  const mins = minutesAgo(updatedAt);
  const timeLabel = mins <= 0 ? 'just now' : `${mins} min ago`;

  return (
    <View
      className="flex-row items-center self-start px-3 py-1.5 rounded-full border mb-4"
      style={{ backgroundColor: Colors.accentBg, borderColor: Colors.accentBorder }}
    >
      <Animated.View
        className="w-1.5 h-1.5 rounded-full mr-2"
        style={{ backgroundColor: Colors.accent, opacity }}
      />
      <Text
        className="text-[11px]"
        style={{ color: Colors.accent, fontFamily: Fonts.body }}
      >
        Live predictions · Updated {timeLabel}
      </Text>
    </View>
  );
}