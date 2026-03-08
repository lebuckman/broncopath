import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

interface Props {
  message: string;
}

export default function CrowdTipCard({ message }: Props) {
  return (
    <View
      className="rounded-2xl border p-4 mb-5"
      style={{ backgroundColor: Colors.accentBg, borderColor: Colors.accentBorder }}
    >
      <View className="flex-row items-center gap-2 mb-2">
        <Feather name="info" size={13} color={Colors.accent} />
        <Text
          className="text-[11px] uppercase"
          style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold, letterSpacing: 0.8 }}
        >
          Crowd Insight
        </Text>
      </View>
      <Text
        className="text-[12px] leading-5"
        style={{ color: Colors.muted, fontFamily: Fonts.body }}
      >
        {message}
      </Text>
    </View>
  );
}