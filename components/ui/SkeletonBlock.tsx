import { Animated } from 'react-native';
import { useShimmer } from '../../hooks/useShimmer';

interface Props {
  className?: string;
  style?: object;
}

export default function SkeletonBlock({ className, style }: Props) {
  const backgroundColor = useShimmer();
  return (
    <Animated.View
      className={`rounded-md ${className ?? ''}`}
      style={[{ backgroundColor }, style]}
    />
  );
}
