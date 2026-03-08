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
      className="rounded-2xl border p-4 flex-row items-start gap-3 mb-5"
      style={{ backgroundColor: Colors.accentBg, borderColor: Colors.accentBorder }}
    >
      <Feather name="info" size={14} color={Colors.accent} style={{ marginTop: 1 }} />
      <Text
        className="text-[12px] flex-1"
        style={{ color: Colors.muted, fontFamily: Fonts.body }}
      >
        {message}
      </Text>
    </View>
  );
}