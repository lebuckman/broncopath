import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

interface Props {
  from: string | null;
  to: string | null;
  onFromPress: () => void;
  onToPress: () => void;
  onSwap?: () => void;
}

export default function RouteInputCard({ from, to, onFromPress, onToPress, onSwap }: Props) {
  return (
    <View
      className="rounded-2xl border p-5 mb-5"
      style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
    >
      <Pressable className="flex-row items-center mb-4" onPress={onFromPress}>
        <View className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: Colors.muted }} />
        <View className="flex-1">
          <Text
            className="text-[10px] uppercase mb-0.5"
            style={{ color: Colors.muted, fontFamily: Fonts.body, letterSpacing: 1 }}
          >
            From
          </Text>
          <Text
            className="text-sm"
            style={{ color: from ? Colors.text : Colors.muted, fontFamily: Fonts.bodyMedium }}
          >
            {from ?? 'Select building…'}
          </Text>
        </View>
        <Feather name="chevron-down" size={14} color={Colors.muted} />
      </Pressable>

      <View style={{ position: 'relative', marginBottom: 16 }}>
        <View style={{ height: 1, backgroundColor: Colors.border }} />
        {onSwap && (
          <Pressable
            onPress={onSwap}
            hitSlop={8}
            style={{
              position: 'absolute',
              right: 0,
              top: -11,
              backgroundColor: Colors.card,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: Colors.border,
              width: 22,
              height: 22,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ transform: [{ rotate: '45deg' }] }}>
              <Feather name="repeat" size={11} color={Colors.muted} />
            </View>
          </Pressable>
        )}
      </View>

      <Pressable className="flex-row items-center" onPress={onToPress}>
        <View className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: Colors.accent }} />
        <View className="flex-1">
          <Text
            className="text-[10px] uppercase mb-0.5"
            style={{ color: Colors.muted, fontFamily: Fonts.body, letterSpacing: 1 }}
          >
            To
          </Text>
          <Text
            className="text-sm"
            style={{ color: to ? Colors.text : Colors.muted, fontFamily: Fonts.bodyMedium }}
          >
            {to ?? 'Select building…'}
          </Text>
        </View>
        <Feather name="chevron-down" size={14} color={Colors.muted} />
      </Pressable>
    </View>
  );
}
