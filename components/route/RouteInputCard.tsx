import { View, Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

interface Props {
  from: string;
  to: string;
}

export default function RouteInputCard({ from, to }: Props) {
  return (
    <View
      className="rounded-2xl border p-5 mb-5"
      style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
    >
      <View className="flex-row items-center mb-4">
        <View className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: Colors.muted }} />
        <View className="flex-1">
          <Text
            className="text-[10px] uppercase mb-0.5"
            style={{ color: Colors.muted, fontFamily: Fonts.body, letterSpacing: 1 }}
          >
            From
          </Text>
          <Text className="text-sm" style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}>
            {from}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center">
        <View className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: Colors.accent }} />
        <View className="flex-1">
          <Text
            className="text-[10px] uppercase mb-0.5"
            style={{ color: Colors.muted, fontFamily: Fonts.body, letterSpacing: 1 }}
          >
            To
          </Text>
          <Text className="text-sm" style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}>
            {to}
          </Text>
        </View>
      </View>
    </View>
  );
}