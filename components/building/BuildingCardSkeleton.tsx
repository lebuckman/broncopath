import { View } from 'react-native';
import { Colors } from '../../constants/colors';
import SkeletonBlock from '../ui/SkeletonBlock';

export default function BuildingCardSkeleton() {
  return (
    <View
      className="rounded-2xl p-5 border"
      style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
    >
      {/* Row 1: title + percentage */}
      <View className="flex-row justify-between items-center mb-1">
        <SkeletonBlock style={{ width: '60%', height: 16 }} />
        <SkeletonBlock style={{ width: '18%', height: 16 }} />
      </View>

      {/* Row 2: code + room count */}
      <SkeletonBlock style={{ width: '45%', height: 14, marginBottom: 12 }} />

      {/* Row 3: density dot + bar + label */}
      <View className="flex-row items-center gap-2">
        <SkeletonBlock style={{ width: 8, height: 8, borderRadius: 4 }} />
        <SkeletonBlock className="flex-1" style={{ height: 4 }} />
        <SkeletonBlock style={{ width: 28, height: 13 }} />
      </View>
    </View>
  );
}
