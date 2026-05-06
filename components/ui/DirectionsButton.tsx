import { useState, useEffect, useRef } from "react";
import { Animated, Dimensions, Modal, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import {
  closeAllDirectionButtons,
  subscribeToDirectionsClose,
} from "../../lib/directionsSignal";

const SCREEN_W = Dimensions.get("window").width;

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
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0, h: 0 });
  const anim = useRef(new Animated.Value(0)).current;
  const iconRef = useRef<View>(null);

  useEffect(() => {
    return subscribeToDirectionsClose(() => {
      anim.stopAnimation();
      anim.setValue(0);
      setOpen(false);
    });
  }, []);

  function handleOpen() {
    closeAllDirectionButtons();
    iconRef.current?.measureInWindow((x, y, width, height) => {
      setPopupPos({ x: x + width, y, h: height });
      setOpen(true);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }).start();
    });
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

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  // Popup sits to the left of the icon, vertically centered with it
  const popupRight = SCREEN_W - popupPos.x + 6;
  const popupTop = popupPos.y + popupPos.h / 2 - 16;

  return (
    <View ref={iconRef} collapsable={false}>
      <Pressable onPress={handleOpen} hitSlop={8}>
        <Feather name="navigation" size={14} color={Colors.accent} />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={handleClose}>
        {/* Full-screen backdrop — tap to close */}
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={handleClose}
        />

        {/* Floating popup */}
        <Animated.View
          style={{
            position: "absolute",
            right: popupRight,
            top: popupTop,
            opacity: anim,
            transform: [{ translateX }],
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: Colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: Colors.border,
            paddingHorizontal: 8,
            paddingVertical: 6,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 8,
          }}
        >
          {OPTIONS.map(({ label, key }) => (
            <Pressable
              key={key}
              onPress={() => handleOption(key)}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 8,
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
        </Animated.View>
      </Modal>
    </View>
  );
}
