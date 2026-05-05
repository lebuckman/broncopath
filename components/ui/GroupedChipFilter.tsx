import { useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import { FILTER_GROUPS } from "../../lib/roomFilters";

interface Props {
  active: string[];
  onChange: (val: string[]) => void;
  showFavorites: boolean;
}

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const DROPDOWN_W = 180;

export default function GroupedChipFilter({
  active,
  onChange,
  showFavorites,
}: Props) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const chipRefs = useRef<Record<string, View | null>>({});

  function openGroupMenu(label: string) {
    if (openGroup === label) {
      setOpenGroup(null);
      setAnchor(null);
      return;
    }
    const group = FILTER_GROUPS.find((g) => g.label === label);
    const dropdownH = Math.min((group?.options.length ?? 4) * 46, 280);
    chipRefs.current[label]?.measureInWindow((x, y, _w, h) => {
      const openUpward = y + h + 6 + dropdownH > SCREEN_H;
      setAnchor({
        x: Math.min(x, SCREEN_W - DROPDOWN_W - 8),
        y: openUpward ? y - dropdownH - 6 : y + h + 6,
      });
      setOpenGroup(label);
    });
  }

  function close() {
    setOpenGroup(null);
    setAnchor(null);
  }

  function toggleOption(option: string) {
    onChange(
      active.includes(option)
        ? active.filter((o) => o !== option)
        : [...active, option],
    );
  }

  const openGroupData = FILTER_GROUPS.find((g) => g.label === openGroup);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {/* All / Clear chip */}
        <Pressable
          onPress={() => {
            onChange([]);
            close();
          }}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            backgroundColor:
              active.length === 0 ? Colors.accentBg : Colors.card,
            borderColor:
              active.length === 0 ? Colors.accentBorder : Colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontFamily: Fonts.bodySemiBold,
              color: active.length === 0 ? Colors.accent : Colors.muted,
            }}
          >
            {active.length > 0 ? "x" : "All"}
          </Text>
        </Pressable>

        {/* Favorites chip */}
        {showFavorites && (
          <Pressable
            onPress={() => toggleOption("Favorites")}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              backgroundColor: active.includes("Favorites")
                ? Colors.accentBg
                : Colors.card,
              borderColor: active.includes("Favorites")
                ? Colors.accentBorder
                : Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: Fonts.bodySemiBold,
                color: active.includes("Favorites")
                  ? Colors.accent
                  : Colors.muted,
              }}
            >
              Favorites
            </Text>
          </Pressable>
        )}

        {/* Group chips */}
        {FILTER_GROUPS.map((group) => {
          const hasActive = group.options.some((o) => active.includes(o));
          const isOpen = openGroup === group.label;
          const highlighted = hasActive;
          return (
            <Pressable
              key={group.label}
              ref={(r) => {
                chipRefs.current[group.label] = r as unknown as View | null;
              }}
              onPress={() => openGroupMenu(group.label)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                backgroundColor: highlighted ? Colors.accentBg : Colors.card,
                borderColor: highlighted ? Colors.accentBorder : Colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: Fonts.bodySemiBold,
                  color: highlighted ? Colors.accent : Colors.muted,
                }}
              >
                {group.label}
              </Text>
              <Feather
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={11}
                color={highlighted ? Colors.accent : Colors.muted}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal
        visible={!!openGroup && !!anchor}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        {/* Full-screen backdrop — tap outside to close */}
        <Pressable style={{ flex: 1 }} onPress={close}>
          {anchor && openGroupData && (
            // Panel wrapper absorbs touches so they don't reach the backdrop
            <Pressable
              onPress={() => {}}
              style={{
                position: "absolute",
                left: anchor.x,
                top: anchor.y,
                width: DROPDOWN_W,
                backgroundColor: Colors.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.borderMd,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 8,
              }}
            >
              {openGroupData.options.map((option, i) => {
                const selected = active.includes(option);
                return (
                  <Pressable
                    key={option}
                    onPress={() => toggleOption(option)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderBottomWidth:
                        i < openGroupData.options.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: selected ? Fonts.bodySemiBold : Fonts.body,
                        color: selected ? Colors.accent : Colors.text,
                      }}
                    >
                      {option}
                    </Text>
                    {selected && (
                      <Feather name="check" size={14} color={Colors.accent} />
                    )}
                  </Pressable>
                );
              })}
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
