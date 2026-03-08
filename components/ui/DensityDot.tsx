import { View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { DensityLevel } from '../../constants/mockData';

type DotLevel = DensityLevel | 'free' | 'occ';

interface Props {
  level: DotLevel;
}

function dotColor(level: DotLevel): string {
  if (level === 'low' || level === 'free') return Colors.low;
  if (level === 'med') return Colors.med;
  return Colors.high;
}

export default function DensityDot({ level }: Props) {
  const color = dotColor(level);
  return (
    <View
      className="w-2 h-2 rounded-full"
      style={{
        backgroundColor: color,
        shadowColor: color,
        shadowOpacity: 0.5,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}