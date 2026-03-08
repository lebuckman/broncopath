import { View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { DensityLevel } from '../../constants/mockData';

interface Props {
  percentage: number;
  level: DensityLevel;
}

function barColor(level: DensityLevel): string {
  if (level === 'low') return Colors.low;
  if (level === 'med') return Colors.med;
  return Colors.high;
}

export default function DensityBar({ percentage, level }: Props) {
  const color = barColor(level);
  const fillWidth = `${Math.min(100, Math.max(0, percentage))}%`;
  return (
    <View
      className="h-1 w-full rounded-full overflow-hidden"
      style={{ backgroundColor: Colors.border }}
    >
      <View
        className="h-full rounded-full"
        style={{ width: fillWidth, backgroundColor: color }}
      />
    </View>
  );
}