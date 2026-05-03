import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import SectionLabel from "./SectionLabel";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SCREEN_H = Dimensions.get("window").height;

export default function InfoModal({ visible, onClose }: Props) {
  const translateY = useRef(new Animated.Value(20)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      translateY.setValue(20);
      setModalVisible(true);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      setModalVisible(false);
    }
  }, [visible, translateY]);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        {/*
          Layer 1 — backdrop (behind). absoluteFillObject so it covers the full
          screen but is rendered before the card, meaning the card sits on top.
          Tapping anywhere outside the card fires onClose.
        */}
        <Pressable
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(0,0,0,0.72)" },
          ]}
          onPress={onClose}
        />

        {/*
          Layer 2 — card (in front). pointerEvents="box-none" means this
          wrapper View itself ignores touches, passing them through to the
          backdrop behind it for empty areas. Its children (the card) still
          receive touches normally.
        */}
        <View
          style={{ flex: 1, justifyContent: "center" }}
          pointerEvents="box-none"
        >
          <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>
            {/* Close button */}
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton}>
              <Feather name="x" size={18} color={Colors.muted} />
            </Pressable>

            <ScrollView
              style={{ maxHeight: SCREEN_H * 0.75 }}
              contentContainerStyle={{ padding: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={{ paddingRight: 28, marginBottom: 4 }}>
                <View style={styles.headerRow}>
                  <Text style={styles.title}>🐴 BroncoPath</Text>
                  <View style={styles.betaPill}>
                    <Text style={styles.betaText}>BETA</Text>
                  </View>
                </View>
                <Text style={styles.subtitle}>How your campus data works</Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Section 1 */}
              <View style={styles.section}>
                <SectionLabel>Data source</SectionLabel>
                <Text style={styles.body}>
                  BroncoPath scrapes Cal Poly Pomona's publicly available class
                  schedule at schedule.cpp.edu — no sensors, no hardware, no
                  special access required. The schedule is published by the
                  university and accessible to anyone on campus.
                </Text>
              </View>

              {/* Section 2 */}
              <View style={styles.section}>
                <SectionLabel>How often it updates</SectionLabel>
                <Text style={styles.body}>
                  The CPP schedule is updated nightly by the university.
                  BroncoPath stays in sync with the current timetable. Within
                  the app, room statuses refresh every 60 seconds while you
                  browse.
                </Text>
              </View>

              {/* Section 3 — Warning box */}
              <View style={styles.section}>
                <SectionLabel>What's not included</SectionLabel>
                <View style={styles.warningBox}>
                  <Text style={[styles.body, { marginBottom: 10 }]}>
                    ⚠️{"  "}Availability is based on scheduled classes only. The
                    following are not accounted for:
                  </Text>
                  {[
                    "Office hours and drop-in sessions",
                    "Club meetings and student org events",
                    "Department and campus-wide events",
                    "Walk-in or informal room use",
                  ].map((item) => (
                    <Text key={item} style={styles.bullet}>
                      {"•  "}
                      {item}
                    </Text>
                  ))}
                  <Text style={[styles.bullet, { marginTop: 8 }]}>
                    A room marked free may still be in use for unofficial
                    activities.
                  </Text>
                </View>
              </View>

              {/* Section 4 */}
              <View style={styles.section}>
                <SectionLabel>Accuracy</SectionLabel>
                <Text style={styles.body}>
                  BroncoPath is a forecast tool, not a real-time sensor. Results
                  are most reliable during regular class hours on weekdays.
                  Accuracy may be lower during evenings, weekends, finals week,
                  and semester breaks when fewer scheduled classes are in
                  session.
                </Text>
              </View>

              {/* Section 5 — Future */}
              <View style={styles.section}>
                <SectionLabel>Coming in future versions</SectionLabel>
                <Text style={styles.body}>
                  Accuracy could be significantly improved by pulling from
                  additional data sources, including:
                </Text>
                {[
                  "The CPP events calendar for campus-wide bookings",
                  "Club room reservations via 25Live or similar systems",
                  "Student org social media (Instagram, Discord) for posted meeting times",
                  "Crowd-sourced check-ins from students",
                ].map((item) => (
                  <Text key={item} style={[styles.bullet, { marginTop: 6 }]}>
                    {"•  "}
                    {item}
                  </Text>
                ))}
              </View>

              {/* Footer */}
              <Text style={styles.footer}>
                schedule.cpp.edu · Updated nightly
              </Text>
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.borderMd,
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.display,
    color: Colors.text,
  },
  betaPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: Colors.accentBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
  betaText: {
    fontSize: 9,
    fontFamily: Fonts.bodyMedium,
    color: Colors.accent,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.muted,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.accentBorder,
    marginVertical: 16,
  },
  section: {
    marginBottom: 20,
  },
  body: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.text,
    lineHeight: 20,
  },
  bullet: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.muted,
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: Colors.medBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.medBorder,
    padding: 14,
  },
  footer: {
    fontSize: 10,
    fontFamily: Fonts.mono,
    color: Colors.muted,
    textAlign: "center",
    marginTop: 4,
  },
});
