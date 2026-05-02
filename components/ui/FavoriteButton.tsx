import { useRef } from "react";
import { Pressable, Animated } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";

interface Props {
  isFavorite: boolean;
  onToggle: () => void;
  size?: number;
}

export default function FavoriteButton({
  isFavorite,
  onToggle,
  size = 14,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.3,
        useNativeDriver: true,
        speed: 50,
      }),
      Animated.spring(scale, {
        toValue: 1.0,
        useNativeDriver: true,
        speed: 50,
      }),
    ]).start();
    onToggle();
  }

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <MaterialIcons
          name={isFavorite ? "star" : "star-outline"}
          size={size}
          color={isFavorite ? Colors.med : Colors.muted}
        />
      </Animated.View>
    </Pressable>
  );
}
