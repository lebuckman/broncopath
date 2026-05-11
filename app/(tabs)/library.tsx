import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";

const CPP_RESERVE_URL =
  "https://www.cpp.edu/library/access-services/group-study-rooms/reserve-a-room.shtml";

const LIBCAL_DIRECT_URL = "https://cpp.libcal.com/reserve/study-rooms";

const TIMES = [
  "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
  "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
  "8:00 PM", "8:30 PM", "9:00 PM",
];

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr", value: 120 },
  { label: "3 hr", value: 180 },
];

const FLOORS = ["Any", "2", "3", "4", "5", "6"];

function getDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: d.toISOString().slice(0, 10),
      label:
        i === 0
          ? "Today"
          : d.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
    };
  });
}

export default function LibraryTab() {
  const days = useMemo(() => getDays(), []);

  const [date, setDate] = useState(days[0].value);
  const [time, setTime] = useState("10:00 AM");
  const [duration, setDuration] = useState(60);
  const [groupSize, setGroupSize] = useState("2");
  const [floor, setFloor] = useState("Any");
  const [power, setPower] = useState(false);
  const [ada, setAda] = useState(false);
  const [policy, setPolicy] = useState(false);
  const [status, setStatus] = useState<"draft" | "sent" | "done">("draft");

  const validGroup = Number(groupSize) >= 2 && Number(groupSize) <= 9;
  const canSubmit = validGroup && policy;

  async function continueToOfficialBooking() {
    if (!validGroup) {
      Alert.alert(
        "Invalid group size",
        "CPP group study rooms require 2 to 9 students."
      );
      return;
    }

    if (!policy) {
      Alert.alert(
        "Policy confirmation required",
        "Confirm that you understand CPP Library policies before continuing."
      );
      return;
    }

    setStatus("sent");
    await Linking.openURL(CPP_RESERVE_URL);
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 44 }}>
        <Text
          style={{
            color: Colors.text,
            fontFamily: Fonts.display,
            fontSize: 28,
          }}
        >
          Library Rooms
        </Text>

        <Text
          style={{
            color: Colors.muted,
            fontFamily: Fonts.body,
            fontSize: 12,
            marginTop: 4,
            marginBottom: 18,
          }}
        >
          Build your reservation, then finish through CPP SSO.
        </Text>

        <InfoCard status={status} />

        <Label icon="calendar">Date</Label>
        <Horizontal>
          {days.map((d) => (
            <Chip
              key={d.value}
              label={d.label}
              selected={date === d.value}
              onPress={() => setDate(d.value)}
            />
          ))}
        </Horizontal>

        <Label icon="clock">Start time</Label>
        <Horizontal>
          {TIMES.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={time === t}
              onPress={() => setTime(t)}
            />
          ))}
        </Horizontal>

        <Label icon="watch">Duration</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DURATIONS.map((d) => (
            <Chip
              key={d.value}
              label={d.label}
              selected={duration === d.value}
              onPress={() => setDuration(d.value)}
            />
          ))}
        </View>

        <Label icon="users">Group size</Label>
        <TextInput
          value={groupSize}
          onChangeText={setGroupSize}
          keyboardType="number-pad"
          placeholder="2-9"
          placeholderTextColor={Colors.muted}
          style={{
            backgroundColor: Colors.card,
            borderColor: validGroup ? Colors.border : Colors.highBorder,
            borderWidth: 1,
            borderRadius: 14,
            color: Colors.text,
            fontFamily: Fonts.body,
            padding: 14,
            marginBottom: 6,
          }}
        />

        <Label icon="layers">Preferred floor</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {FLOORS.map((f) => (
            <Chip
              key={f}
              label={f === "Any" ? "Any floor" : `Floor ${f}`}
              selected={floor === f}
              onPress={() => setFloor(f)}
            />
          ))}
        </View>

        <Label icon="sliders">Preferences</Label>
        <Toggle
          label="Power outlet preferred"
          value={power}
          onPress={() => setPower(!power)}
        />
        <Toggle
          label="ADA-accessible room preferred"
          value={ada}
          onPress={() => setAda(!ada)}
        />

        <View
          style={{
            backgroundColor: Colors.surface,
            borderColor: Colors.border,
            borderWidth: 1,
            borderRadius: 18,
            padding: 16,
            marginTop: 16,
          }}
        >
          <Text
            style={{
              color: Colors.text,
              fontFamily: Fonts.bodySemiBold,
              fontSize: 14,
              marginBottom: 10,
            }}
          >
            Reservation draft
          </Text>

          <Summary label="Date" value={date} />
          <Summary label="Time" value={time} />
          <Summary label="Duration" value={`${duration} minutes`} />
          <Summary label="Group" value={`${groupSize} students`} />
          <Summary
            label="Needs"
            value={[
              floor === "Any" ? "Any floor" : `Floor ${floor}`,
              power ? "Power outlet" : null,
              ada ? "ADA" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        </View>

        <Pressable
          onPress={() => setPolicy(!policy)}
          style={{
            backgroundColor: policy ? Colors.accentBg : Colors.card,
            borderColor: policy ? Colors.accentBorder : Colors.border,
            borderWidth: 1,
            borderRadius: 18,
            padding: 16,
            marginTop: 14,
            flexDirection: "row",
            gap: 12,
          }}
        >
          <Feather
            name={policy ? "check-square" : "square"}
            size={22}
            color={policy ? Colors.accent : Colors.muted}
          />
          <Text
            style={{
              color: Colors.text,
              fontFamily: Fonts.body,
              fontSize: 12,
              lineHeight: 18,
              flex: 1,
            }}
          >
            I understand final booking must be completed through CPP Library,
            including policy agreement and CPP SSO.
          </Text>
        </Pressable>

        <Pressable
          disabled={!canSubmit}
          onPress={continueToOfficialBooking}
          style={{
            backgroundColor: canSubmit ? Colors.accent : Colors.cardHover,
            opacity: canSubmit ? 1 : 0.55,
            borderRadius: 14,
            padding: 16,
            marginTop: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Feather
            name="external-link"
            size={16}
            color={canSubmit ? Colors.bg : Colors.muted}
          />
          <Text
            style={{
              color: canSubmit ? Colors.bg : Colors.muted,
              fontFamily: Fonts.bodySemiBold,
              fontSize: 13,
            }}
          >
            Review Policies & Reserve
          </Text>
        </Pressable>

        {status === "sent" && (
          <Pressable
            onPress={() => setStatus("done")}
            style={{
              borderColor: Colors.accentBorder,
              borderWidth: 1,
              borderRadius: 14,
              padding: 14,
              marginTop: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: Colors.accent,
                fontFamily: Fonts.bodySemiBold,
                fontSize: 12,
              }}
            >
              I completed my LibCal reservation
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => Linking.openURL(LIBCAL_DIRECT_URL)}
          style={{ padding: 14, alignItems: "center" }}
        >
          <Text
            style={{
              color: Colors.muted,
              fontFamily: Fonts.body,
              fontSize: 12,
            }}
          >
            Open LibCal directly
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ status }: { status: "draft" | "sent" | "done" }) {
  const text =
    status === "done"
      ? "Reservation marked complete in-app. Official confirmation remains in CPP/LibCal email."
      : status === "sent"
      ? "Official CPP booking page opened. Finish policy agreement, SSO, and final room selection there."
      : "This app prepares the reservation intent. Final submission happens through CPP Library/LibCal.";

  return (
    <View
      style={{
        backgroundColor: Colors.card,
        borderColor: Colors.border,
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 18,
      }}
    >
      <Text
        style={{
          color: Colors.text,
          fontFamily: Fonts.bodySemiBold,
          fontSize: 14,
          marginBottom: 6,
        }}
      >
        Official SSO handoff
      </Text>
      <Text
        style={{
          color: Colors.muted,
          fontFamily: Fonts.body,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function Label({
  icon,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  children: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 18, marginBottom: 10 }}>
      <Feather name={icon} size={15} color={Colors.accent} />
      <Text
        style={{
          color: Colors.muted,
          fontFamily: Fonts.bodySemiBold,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.7,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function Horizontal({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 20 }}
    >
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? Colors.accentBg : Colors.card,
        borderColor: selected ? Colors.accentBorder : Colors.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <Text
        style={{
          color: selected ? Colors.accent : Colors.text,
          fontFamily: selected ? Fonts.bodySemiBold : Fonts.body,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Toggle({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: Colors.card,
        borderColor: value ? Colors.accentBorder : Colors.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ color: Colors.text, fontFamily: Fonts.body, fontSize: 13 }}>
        {label}
      </Text>
      <Feather
        name={value ? "toggle-right" : "toggle-left"}
        size={28}
        color={value ? Colors.accent : Colors.muted}
      />
    </Pressable>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 3 }}>
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12 }}>
        {label}
      </Text>
      <Text
        style={{
          color: Colors.text,
          fontFamily: Fonts.bodyMedium,
          fontSize: 12,
          flex: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}