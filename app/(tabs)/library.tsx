/**
 * app/(tabs)/library.tsx
 *
 * Native filter/results UI backed by BroncoPath's Express adapter.
 * Final booking stays in LibCal WebView so CPP SSO is handled by CPP.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import {
  getLibraryAvailability,
  type LibraryRoomResult,
} from "../../lib/api";

const LIBCAL_BASE = "https://cpp.libcal.com";
const LID = 8262;

const TIME_SLOTS = [
  "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00",
];

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr", value: 120 },
  { label: "3 hr", value: 180 },
];

const FLOORS = [
  { label: "Any", value: "any" },
  { label: "Floor 2", value: "2" },
  { label: "Floor 3", value: "3" },
  { label: "Floor 4", value: "4" },
  { label: "Floor 5", value: "5" },
  { label: "Floor 6", value: "6" },
];

type Filters = {
  date: string;
  startTime: string;
  duration: number;
  groupSize: number;
  floor: string;
  needsPower: boolean;
  needsADA: boolean;
};

type RoomWithSlots = {
  room: LibraryRoomResult;
  isAvailable: boolean;
};

type Step = "filter" | "results" | "booking";

function getDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: formatDateValue(d),
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

function formatDateValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function to12h(time24: string): string {
  const [hStr = "0", mStr = "00"] = time24.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${mStr} ${period}`;
}

function toLibCalTimeLabel(time24: string): string {
  return to12h(time24).replace(" ", "").toLowerCase();
}

function addMins(time24: string, minutes: number): string {
  const [h = 0, m = 0] = time24.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function addDateTime(date: string, time24: string, minutes: number): { date: string; time: string } {
  const [yearText, monthText, dayText] = date.split("-");
  const [hourText, minuteText] = time24.split(":");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const total = hour * 60 + minute + minutes;
  const dayOffset = Math.floor(total / 1440);
  const minuteOfDay = ((total % 1440) + 1440) % 1440;
  const adjusted = new Date(Date.UTC(year, month - 1, day + dayOffset));

  return {
    date: adjusted.toISOString().slice(0, 10),
    time: `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`,
  };
}

function slotKeyTo12h(slotKey: string | null): string | null {
  const time = slotKey?.split("T")[1];
  return time ? to12h(time) : null;
}

function buildLibCalDirectUrl(date: string): string {
  return `${LIBCAL_BASE}/reserve/study-rooms?lid=${LID}&gid=0&dt=${date}`;
}

function buildInjectJS(
  date: string,
  startTime: string,
  duration: number,
  room: LibraryRoomResult,
): string {
  const end = addDateTime(date, startTime, duration);
  const config = {
    date,
    roomName: room.name,
    startLabel: toLibCalTimeLabel(startTime),
    endLabel: toLibCalTimeLabel(end.time),
    endValueSpace: `${end.date} ${end.time}:00`,
    endValueIso: `${end.date}T${end.time}`,
    pageIndex: room.pageIndex,
    duration,
  };

  return `
(function() {
  var config = ${JSON.stringify(config)};
  var attempts = 0;

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '').trim();
  }

  function datePhrase() {
    var d = new Date(config.date + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function applyPageIndex() {
    try {
      if (window.springyPage && typeof window.springyPage.pageIndex !== 'undefined') {
        window.springyPage.pageIndex = config.pageIndex || 0;
      }
    } catch (e) {}
  }

  function findMatchingSlot() {
    var wantedRoom = normalize(config.roomName);
    var wantedTime = normalize(config.startLabel);
    var wantedDate = normalize(datePhrase());
    var candidates = Array.prototype.slice.call(
      document.querySelectorAll('a.s-lc-eq-avail[title], a.s-lc-eq-avail[aria-label]')
    );

    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var text = normalize(el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || '');
      if (text.indexOf(wantedRoom) !== -1 && text.indexOf(wantedTime) !== -1 && text.indexOf(wantedDate) !== -1) {
        return el;
      }
    }

    return null;
  }

  function clickSlot() {
    if (window.__broncoPathSlotClicked) return true;

    var slot = findMatchingSlot();
    if (!slot) return false;

    window.__broncoPathSlotClicked = true;
    slot.scrollIntoView({ block: 'center', inline: 'center' });
    slot.click();
    return true;
  }

  function selectEndTime() {
    if (!window.__broncoPathSlotClicked) return false;
    if (window.__broncoPathEndSelected) return true;

    var selects = Array.prototype.slice.call(document.querySelectorAll('select.b-end-date'));
    if (selects.length === 0) return config.duration === 180;

    for (var i = 0; i < selects.length; i++) {
      var select = selects[i];
      var options = Array.prototype.slice.call(select.options || []);

      for (var j = 0; j < options.length; j++) {
        var option = options[j];
        var value = String(option.value || '');
        var label = normalize(option.textContent || '');
        if (
          value.indexOf(config.endValueSpace) !== -1 ||
          value.indexOf(config.endValueIso) !== -1 ||
          label.indexOf(normalize(config.endLabel)) !== -1
        ) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          window.__broncoPathEndSelected = true;
          return true;
        }
      }
    }

    return false;
  }

  function submitTimes() {
    if (window.__broncoPathSubmitTimesClicked) return true;

    var button = document.querySelector('#submit_times');
    if (!button || button.disabled) return false;

    window.__broncoPathSubmitTimesClicked = true;
    button.scrollIntoView({ block: 'center' });
    button.click();
    return true;
  }

  var timer = setInterval(function() {
    attempts += 1;
    applyPageIndex();

    if (!clickSlot()) {
      if (attempts > 40) clearInterval(timer);
      return;
    }

    if (selectEndTime()) {
      setTimeout(submitTimes, 700);
      if (window.__broncoPathSubmitTimesClicked || attempts > 40) {
        clearInterval(timer);
      }
    }

    if (attempts > 40) clearInterval(timer);
  }, 500);
})();
true;
  `.trim();
}

export default function LibraryScreen() {
  const days = useMemo(() => getDays(), []);

  const [step, setStep] = useState<Step>("filter");
  const [filters, setFilters] = useState<Filters>({
    date: days[0]?.value ?? formatDateValue(new Date()),
    startTime: "10:00",
    duration: 60,
    groupSize: 2,
    floor: "any",
    needsPower: false,
    needsADA: false,
  });

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [results, setResults] = useState<RoomWithSlots[]>([]);
  const [bookingRoom, setBookingRoom] = useState<LibraryRoomResult | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback((direction: 1 | -1) => {
    slideAnim.setValue(direction * 40);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [slideAnim]);

  async function handleSearch() {
    setStep("results");
    setLoading(true);
    setApiError(null);
    setResults([]);
    animateTo(1);

    try {
      const rooms = await getLibraryAvailability(filters);
      setResults(rooms.map((room) => ({ room, isAvailable: room.isAvailable })));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LibCal error";
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }

  function openBooking(room: LibraryRoomResult) {
    setBookingRoom(room);
    setWebViewReady(false);
    animateTo(1);
    setStep("booking");
  }

  function goBack() {
    animateTo(-1);
    if (step === "booking") {
      setStep("results");
      setBookingRoom(null);
      setWebViewReady(false);
    } else {
      setStep("filter");
    }
  }

  const bookingUrl = bookingRoom?.bookingUrl ?? "";

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: Colors.bg }}
    >
      {step !== "filter" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 8,
            borderBottomColor: Colors.border,
            borderBottomWidth: 1,
          }}
        >
          <Pressable onPress={goBack} hitSlop={8} style={{ marginRight: 12 }}>
            <Feather name="arrow-left" size={20} color={Colors.text} />
          </Pressable>
          <Text style={{ color: Colors.text, fontFamily: Fonts.display, fontSize: 20, flex: 1 }}>
            {step === "results"
              ? "Available Rooms"
              : bookingRoom?.name ?? "Reserve Room"}
          </Text>
          {step === "results" && (
            <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 11 }}>
              {results.filter((r) => r.isAvailable).length} open
            </Text>
          )}
        </View>
      )}

      <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }}>
        {step === "filter" && (
          <FilterStep
            days={days}
            filters={filters}
            onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onSearch={handleSearch}
          />
        )}

        {step === "results" && (
          <ResultsStep
            loading={loading}
            error={apiError}
            results={results}
            filters={filters}
            onBook={openBooking}
            onOpenDirect={() => Linking.openURL(buildLibCalDirectUrl(filters.date))}
          />
        )}

        {step === "booking" && bookingRoom && (
          <BookingStep
            url={bookingUrl}
            injectJS={buildInjectJS(filters.date, filters.startTime, filters.duration, bookingRoom)}
            room={bookingRoom}
            filters={filters}
            ready={webViewReady}
            onReady={() => setWebViewReady(true)}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

type FilterStepProps = {
  days: { value: string; label: string }[];
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onSearch: () => void;
};

function FilterStep({ days, filters, onChange, onSearch }: FilterStepProps) {
  const endTime = addMins(filters.startTime, filters.duration);
  const [searchPressed, setSearchPressed] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: Colors.text, fontFamily: Fonts.display, fontSize: 28, marginBottom: 4 }}>
        Library Rooms
      </Text>
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12, marginBottom: 24, lineHeight: 18 }}>
        Pick a date, time, capacity, and room specs. BroncoPath checks availability; CPP handles SSO.
      </Text>

      <FilterLabel icon="calendar">Date</FilterLabel>
      <HScroll>
        {days.map((d) => (
          <Chip
            key={d.value}
            label={d.label}
            selected={filters.date === d.value}
            onPress={() => onChange({ date: d.value })}
          />
        ))}
      </HScroll>

      <FilterLabel icon="clock">Start time</FilterLabel>
      <HScroll>
        {TIME_SLOTS.map((t) => (
          <Chip
            key={t}
            label={to12h(t)}
            selected={filters.startTime === t}
            onPress={() => onChange({ startTime: t })}
          />
        ))}
      </HScroll>

      <FilterLabel icon="watch">Duration</FilterLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        {DURATIONS.map((d) => (
          <Chip
            key={d.value}
            label={d.label}
            selected={filters.duration === d.value}
            onPress={() => onChange({ duration: d.value })}
          />
        ))}
      </View>

      <Text style={{
        color: Colors.muted,
        fontFamily: Fonts.body,
        fontSize: 11,
        marginTop: 6,
        marginBottom: 20,
      }}>
        {to12h(filters.startTime)} – {to12h(endTime)}
      </Text>

      <FilterLabel icon="users">Group size</FilterLabel>
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: Colors.card,
        borderColor: Colors.border,
        borderWidth: 1,
        borderRadius: 16,
        alignSelf: "flex-start",
        marginBottom: 20,
        overflow: "hidden",
      }}>
        <StepperBtn
          icon="minus"
          disabled={filters.groupSize <= 2}
          onPress={() => onChange({ groupSize: Math.max(2, filters.groupSize - 1) })}
        />
        <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
          <Text style={{ color: Colors.text, fontFamily: Fonts.bodySemiBold, fontSize: 18 }}>
            {filters.groupSize}
          </Text>
        </View>
        <StepperBtn
          icon="plus"
          disabled={filters.groupSize >= 9}
          onPress={() => onChange({ groupSize: Math.min(9, filters.groupSize + 1) })}
        />
      </View>
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginTop: -14, marginBottom: 20 }}>
        CPP group rooms require 2 – 9 students
      </Text>

      <FilterLabel icon="layers">Preferred floor</FilterLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {FLOORS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            selected={filters.floor === f.value}
            onPress={() => onChange({ floor: f.value })}
          />
        ))}
      </View>

      <FilterLabel icon="sliders">Preferences</FilterLabel>
      <Toggle
        label="Power outlet"
        icon="zap"
        value={filters.needsPower}
        onPress={() => onChange({ needsPower: !filters.needsPower })}
      />
      <Toggle
        label="ADA accessible"
        icon="check-circle"
        value={filters.needsADA}
        onPress={() => onChange({ needsADA: !filters.needsADA })}
      />

      <Pressable
        onPress={onSearch}
        onPressIn={() => setSearchPressed(true)}
        onPressOut={() => setSearchPressed(false)}
        style={{
          marginTop: 28,
          backgroundColor: searchPressed ? Colors.accentDim : Colors.accent,
          borderRadius: 16,
          paddingVertical: 16,
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Feather name="search" size={16} color={Colors.bg} />
        <Text style={{ color: Colors.bg, fontFamily: Fonts.bodySemiBold, fontSize: 15 }}>
          Find Available Rooms
        </Text>
      </Pressable>
    </ScrollView>
  );
}

type ResultsStepProps = {
  loading: boolean;
  error: string | null;
  results: RoomWithSlots[];
  filters: Filters;
  onBook: (room: LibraryRoomResult) => void;
  onOpenDirect: () => void;
};

function ResultsStep({
  loading,
  error,
  results,
  filters,
  onBook,
  onOpenDirect,
}: ResultsStepProps) {
  const endTime = addMins(filters.startTime, filters.duration);
  const available = results.filter((r) => r.isAvailable);
  const unavailable = results.filter((r) => !r.isAvailable);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 13, marginTop: 14 }}>
          Checking LibCal through BroncoPath…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Feather name="wifi-off" size={36} color={Colors.muted} style={{ marginBottom: 14 }} />
        <Text style={{
          color: Colors.text,
          fontFamily: Fonts.bodyMedium,
          fontSize: 16,
          textAlign: "center",
          marginBottom: 8,
        }}>
          Couldn't read LibCal availability
        </Text>
        <Text style={{
          color: Colors.muted,
          fontFamily: Fonts.body,
          fontSize: 12,
          textAlign: "center",
          marginBottom: 28,
          lineHeight: 18,
        }}>
          The backend could not reach or parse LibCal. Open LibCal directly to continue with CPP's booking page.
        </Text>
        <ActionButton
          icon="external-link"
          label="Open LibCal Directly"
          onPress={onOpenDirect}
        />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 10, marginTop: 18, textAlign: "center" }}>
          {error}
        </Text>
      </View>
    );
  }

  const summaryParts = [
    `${to12h(filters.startTime)} – ${to12h(endTime)}`,
    `${filters.groupSize} people`,
    filters.floor !== "any" ? `Floor ${filters.floor}` : null,
    filters.needsPower ? "Power" : null,
    filters.needsADA ? "ADA" : null,
  ].filter(Boolean).join(" · ");

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{
        backgroundColor: Colors.card,
        borderColor: Colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}>
        <Feather name="filter" size={13} color={Colors.muted} />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, flex: 1 }}>
          {summaryParts}
        </Text>
      </View>

      {available.length === 0 && unavailable.length === 0 && (
        <EmptyResults onOpenDirect={onOpenDirect} />
      )}

      {available.length > 0 && (
        <>
          <SectionLabel>Available ({available.length})</SectionLabel>
          {available.map(({ room }) => (
            <RoomCard
              key={room.eid}
              room={room}
              available
              onBook={() => onBook(room)}
            />
          ))}
        </>
      )}

      {unavailable.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: available.length > 0 ? 24 : 0 }}>
            Matching specs, unavailable now ({unavailable.length})
          </SectionLabel>
          {unavailable.map(({ room }) => (
            <RoomCard
              key={room.eid}
              room={room}
              available={false}
              onBook={() => onBook(room)}
            />
          ))}
        </>
      )}

      <Pressable
        onPress={onOpenDirect}
        style={{ marginTop: 24, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
      >
        <Feather name="external-link" size={12} color={Colors.muted} />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>
          Browse full LibCal calendar
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function EmptyResults({ onOpenDirect }: { onOpenDirect: () => void }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 32 }}>
      <Feather name="inbox" size={34} color={Colors.muted} style={{ marginBottom: 12 }} />
      <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 15, marginBottom: 4 }}>
        No rooms matched
      </Text>
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12, textAlign: "center", lineHeight: 18 }}>
        Try another floor, group size, time, or preference combination.
      </Text>
      <Pressable onPress={onOpenDirect} style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name="external-link" size={13} color={Colors.accent} />
        <Text style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold, fontSize: 12 }}>
          Open LibCal directly
        </Text>
      </Pressable>
    </View>
  );
}

type BookingStepProps = {
  url: string;
  injectJS: string;
  room: LibraryRoomResult;
  filters: Filters;
  ready: boolean;
  onReady: () => void;
};

function BookingStep({ url, injectJS, room, filters, ready, onReady }: BookingStepProps) {
  const endTime = addMins(filters.startTime, filters.duration);

  return (
    <View style={{ flex: 1 }}>
      <View style={{
        backgroundColor: Colors.surface,
        borderBottomColor: Colors.border,
        borderBottomWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}>
        <View style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: room.isAvailable ? Colors.accent : Colors.med,
        }} />
        <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 13, flex: 1 }} numberOfLines={1}>
          {room.name}
        </Text>
        <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 11 }}>
          {to12h(filters.startTime)}–{to12h(endTime)}
        </Text>
      </View>

      {!ready && (
        <View style={{
          position: "absolute",
          top: 64,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: Colors.bg,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 13, marginTop: 14 }}>
            Loading LibCal…
          </Text>
        </View>
      )}

      <WebView
        source={{ uri: url }}
        injectedJavaScript={injectJS}
        onLoadEnd={onReady}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: Colors.bg }}
        onNavigationStateChange={(nav: WebViewNavigation) => {
          if (nav.url.includes("/booking/")) {
            // User can view LibCal confirmation in the WebView.
          }
        }}
      />

      <View style={{
        backgroundColor: Colors.surface,
        borderTopColor: Colors.border,
        borderTopWidth: 1,
        paddingHorizontal: 20,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}>
        <Feather name="lock" size={12} color={Colors.muted} />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, flex: 1, lineHeight: 16 }}>
          BroncoPath will try to select the slot and open CPP SSO. After login, confirm the final LibCal form.
        </Text>
      </View>
    </View>
  );
}

function FilterLabel({
  icon,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  children: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10, marginTop: 4 }}>
      <Feather name={icon} size={13} color={Colors.accent} />
      <Text style={{
        color: Colors.muted,
        fontFamily: Fonts.bodySemiBold,
        fontSize: 11,
        letterSpacing: 0.9,
        textTransform: "uppercase",
      }}>
        {children}
      </Text>
    </View>
  );
}

function HScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 4, marginBottom: 20 }}
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
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        backgroundColor: selected
          ? Colors.accentBg
          : pressed
          ? Colors.cardHover
          : Colors.card,
        borderColor: selected ? Colors.accentBorder : Colors.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <Text style={{
        color: selected ? Colors.accent : Colors.text,
        fontFamily: selected ? Fonts.bodySemiBold : Fonts.body,
        fontSize: 12,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StepperBtn({
  icon,
  disabled,
  onPress,
}: {
  icon: "plus" | "minus";
  disabled: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={{
        paddingHorizontal: 18,
        paddingVertical: 14,
        backgroundColor: pressed ? Colors.cardHover : "transparent",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Feather name={icon} size={16} color={Colors.text} />
    </Pressable>
  );
}

function Toggle({
  label,
  icon,
  value,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        backgroundColor: value
          ? Colors.accentBg
          : pressed
          ? Colors.cardHover
          : Colors.card,
        borderColor: value ? Colors.accentBorder : Colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Feather
        name={icon}
        size={15}
        color={value ? Colors.accent : Colors.muted}
      />
      <Text style={{
        flex: 1,
        color: value ? Colors.accent : Colors.text,
        fontFamily: value ? Fonts.bodySemiBold : Fonts.body,
        fontSize: 13,
      }}>
        {label}
      </Text>
      <View style={{
        width: 28,
        height: 17,
        borderRadius: 9,
        backgroundColor: value ? Colors.accent : Colors.border,
        justifyContent: "center",
        paddingHorizontal: 2,
      }}>
        <View style={{
          width: 13,
          height: 13,
          borderRadius: 7,
          backgroundColor: Colors.bg,
          alignSelf: value ? "flex-end" : "flex-start",
        }} />
      </View>
    </Pressable>
  );
}

function SectionLabel({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Text style={[{
      color: Colors.muted,
      fontFamily: Fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      marginBottom: 10,
    }, style]}>
      {children}
    </Text>
  );
}

function RoomCard({
  room,
  available,
  onBook,
}: {
  room: LibraryRoomResult;
  available: boolean;
  onBook: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const nextAvailable = slotKeyTo12h(room.nextAvailableStart);

  return (
    <View style={{
      backgroundColor: Colors.card,
      borderColor: available ? Colors.accentBorder : Colors.border,
      borderWidth: 1,
      borderRadius: 18,
      marginBottom: 10,
      overflow: "hidden",
    }}>
      <View style={{
        height: 3,
        backgroundColor: available ? Colors.accent : Colors.border,
      }} />

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontFamily: Fonts.bodySemiBold, fontSize: 15, marginBottom: 3 }}>
              {room.name}
            </Text>
            <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginBottom: 8 }} numberOfLines={1}>
              {room.grouping}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {room.floor && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="layers" size={11} color={Colors.muted} />
                  <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>
                    Floor {room.floor}
                  </Text>
                </View>
              )}
              {room.capacity > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="users" size={11} color={Colors.muted} />
                  <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>
                    Up to {room.capacity}
                  </Text>
                </View>
              )}
              {!available && nextAvailable && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="clock" size={11} color={Colors.med} />
                  <Text style={{ color: Colors.med, fontFamily: Fonts.body, fontSize: 11 }}>
                    Next {nextAvailable}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 99,
            backgroundColor: available ? Colors.accentBg : Colors.surface,
            borderColor: available ? Colors.accentBorder : Colors.border,
            borderWidth: 1,
          }}>
            <Text style={{
              color: available ? Colors.accent : Colors.muted,
              fontFamily: Fonts.bodySemiBold,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}>
              {available ? "Open" : "Taken"}
            </Text>
          </View>
        </View>

        {(room.hasPower || room.isADA) && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {room.hasPower && <AttributeBadge icon="zap" label="Power" color={Colors.med} />}
            {room.isADA && <AttributeBadge icon="check-circle" label="ADA" color={Colors.low} />}
          </View>
        )}

        <Pressable
          onPress={onBook}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={{
            backgroundColor: available
              ? pressed ? Colors.accentDim : Colors.accent
              : pressed ? Colors.cardHover : Colors.surface,
            borderRadius: 12,
            paddingVertical: 11,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 7,
            borderColor: available ? "transparent" : Colors.border,
            borderWidth: available ? 0 : 1,
          }}
        >
          <Feather
            name="external-link"
            size={14}
            color={available ? Colors.bg : Colors.muted}
          />
          <Text style={{
            color: available ? Colors.bg : Colors.muted,
            fontFamily: Fonts.bodySemiBold,
            fontSize: 13,
          }}>
            {available ? "Reserve via LibCal" : "Check on LibCal"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function AttributeBadge({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: Colors.surface,
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderColor: Colors.border,
      borderWidth: 1,
    }}>
      <Feather name={icon} size={11} color={color} />
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        backgroundColor: pressed ? Colors.cardHover : Colors.accentBg,
        borderColor: Colors.accentBorder,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 24,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Feather name={icon} size={15} color={Colors.accent} />
      <Text style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
