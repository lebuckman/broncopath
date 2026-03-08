import { View, Text } from 'react-native';
import { Colors } from '../../constants/colors';

type BadgeStatus = 'free' | 'busy' | 'soon';

interface Props {
  status: BadgeStatus;
  label?: string;
}

const BADGE: Record<BadgeStatus, { bg: string; text: string; defaultLabel: string }> = {
  free: { bg: Colors.accentBg, text: Colors.accent, defaultLabel: 'Free'   },
  busy: { bg: Colors.highBg,   text: Colors.high,   defaultLabel: 'In Use' },
  soon: { bg: Colors.medBg,    text: Colors.med,    defaultLabel: 'Soon'   },
};

export default function RoomBadge({ status, label }: Props) {
  const { bg, text, defaultLabel } = BADGE[status];
  return (
    <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: bg }}>
      <Text
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: text }}
      >
        {label ?? defaultLabel}
      </Text>
    </View>
  );
}