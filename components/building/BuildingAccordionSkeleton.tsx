import { View } from 'react-native';
import { Colors } from '../../constants/colors';
import SkeletonBlock from '../ui/SkeletonBlock';

export default function BuildingAccordionSkeleton() {
  return (
    <View
      className="mb-2.5 rounded-2xl border"
      style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
    >
      <View className="flex-row items-center justify-between p-5">
        {/* Left: title + subtitle */}
        <View className="flex-1 mr-3">
          <SkeletonBlock style={{ width: '55%', height: 16, marginBottom: 4 }} />
          <SkeletonBlock style={{ width: '35%', height: 13 }} />
        </View>

        {/* Right: chevron placeholder */}
        <SkeletonBlock style={{ width: 16, height: 16 }} />
      </View>
    </View>
  );
}
