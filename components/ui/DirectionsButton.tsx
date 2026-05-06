import { useState, useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import {
  closeAllDirectionButtons,
  subscribeToDirectionsClose,
} from "../../lib/directionsSignal";

type Props = {
  onSetFrom: () => void;
  onSetTo: () => void;
  onViewOnMap: () => void;
};

const OPTIONS: { label: string; key: "from" | "to" | "view" }[] = [
  { label: "From", key: "from" },
  { label: "To", key: "to" },
  { label: "View", key: "view" },
];

export default function DirectionsButton({ onSetFrom, onSetTo, onViewOnMap }: Props) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Close instantly when any other interaction broadcasts close-all
  useEffect(() => {
    return subscribeToDirectionsClose(() => {
      anim.stopAnimation();
      anim.setValue(0);
      setOpen(false);
    });
  }, []);

  function handleOpen() {
    closeAllDirectionButtons(); // close any other open button first
    setOpen(true);
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }

  function handleClose() {
    Animated.timing(anim, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => setOpen(false));
  }

  function handleOption(key: "from" | "to" | "view") {
    handleClose();
    if (key === "from") onSetFrom();
    else if (key === "to") onSetTo();
    else onViewOnMap();
  }

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  return (
    <View>
      {open ? (
        <Animated.View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            opacity: anim,
            transform: [{ translateY }],
          }}
        >
          {OPTIONS.map(({ label, key }) => (
            <Pressable
              key={key}
              onPress={() => handleOption(key)}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 10,
                backgroundColor: Colors.accentBg,
                borderWidth: 1,
                borderColor: Colors.accentBorder,
              }}
            >
              <Text
                style={{
                  color: Colors.accent,
                  fontFamily: Fonts.bodyMedium,
                  fontSize: 11,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={handleClose} hitSlop={8}>
            <Feather name="x" size={13} color={Colors.muted} />
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable onPress={handleOpen} hitSlop={8}>
          <Feather name="navigation" size={14} color={Colors.accent} />
        </Pressable>
      )}
    </View>
  );
}
