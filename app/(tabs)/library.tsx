/**
 * app/(tabs)/library.tsx
 *
 * Three-step library room booking flow:
 *   Filter → Results (live from LibCal API) → Book (WebView + SSO)
 *
 * Requires: npx expo install react-native-webview  (then npx expo run:ios)
 * Add tab to app/(tabs)/_layout.tsx:
 *   <Tabs.Screen name="library" options={{ title: "Library",
 *     tabBarIcon: ({ color }) => <Feather name="book-open" size={20} color={color} /> }} />
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { label: "1 hr",   value: 60 },
  { label: "1.5 hr", value: 90 },
  { label: "2 hr",   value: 120 },
  { label: "3 hr",   value: 180 },
];

const FLOORS = [
  { label: "Any",     value: "any" },
  { label: "Floor 2", value: "2" },
  { label: "Floor 3", value: "3" },
  { label: "Floor 4", value: "4" },
  { label: "Floor 5", value: "5" },
  { label: "Floor 6", value: "6" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Filters {
  date: string;
  startTime: string;   // "HH:MM" 24h
  duration: number;    // minutes
  groupSize: number;   // 2–9
  floor: string;
  needsPower: boolean;
  needsADA: boolean;
}

interface LibCalRoom {
  id: number;
  title: string;
  description: string;
  capacity: number;
  floor: string | null;
  hasPower: boolean;
  isADA: boolean;
}

interface RoomWithSlots {
  room: LibCalRoom;
  isAvailable: boolean;
}

type Step = "filter" | "results" | "booking";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function to12h(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr!, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${mStr} ${period}`;
}

function addMins(time24: string, minutes: number): string {
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function extractFloor(title: string): string | null {
  const m = title.match(/\b([2-6])\d{2}\b/);
  return m?.[1] ?? null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchRoomList(): Promise<LibCalRoom[]> {
  const res = await fetch(
    `${LIBCAL_BASE}/api/1.1/space/categories/${LID}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`categories ${res.status}`);
  const data = await res.json();

  const rooms: LibCalRoom[] = [];
  for (const cat of data.categories ?? []) {
    for (const item of (cat.items ?? cat.spaces ?? [])) {
      const attrs: { name: string }[] = item.attributes ?? [];
      rooms.push({
        id: item.id,
        title: item.name ?? item.title ?? "Study Room",
        description: item.description ?? "",
        capacity: item.capacity ?? 0,
        floor: extractFloor(item.name ?? item.title ?? ""),
        hasPower: attrs.some((a) => /power/i.test(a.name)),
        isADA:    attrs.some((a) => /accessible|ada/i.test(a.name)),
      });
    }
  }
  return rooms;
}

async function fetchAvailability(
  ids: number[],
  date: string,
): Promise<Record<number, { from: string; to: string }[]>> {
  if (ids.length === 0) return {};
  const res = await fetch(
    `${LIBCAL_BASE}/api/1.1/space/availability/${ids.join(",")}?availability=${date}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`availability ${res.status}`);
  const data: any[] = await res.json();
  const result: Record<number, { from: string; to: string }[]> = {};
  for (const item of data) {
    result[item.id] = item.availability ?? [];
  }
  return result;
}

function filterAndMatch(
  rooms: LibCalRoom[],
  availability: Record<number, { from: string; to: string }[]>,
  filters: Filters,
): RoomWithSlots[] {
  const endTime  = addMins(filters.startTime, filters.duration);
  const wantStart = new Date(`${filters.date}T${filters.startTime}:00`);
  const wantEnd   = new Date(`${filters.date}T${endTime}:00`);
  const slotsNeeded = filters.duration / 30;

  return rooms
    .filter((r) => {
      if (filters.floor !== "any" && r.floor !== filters.floor) return false;
      if (r.capacity > 0 && filters.groupSize > r.capacity) return false;
      if (filters.needsPower && !r.hasPower) return false;
      if (filters.needsADA && !r.isADA) return false;
      return true;
    })
    .map((room) => {
      const slots = availability[room.id] ?? [];
      let matching = 0;
      for (const slot of slots) {
        const s = new Date(slot.from);
        const e = new Date(slot.to);
        if (s >= wantStart && e <= wantEnd) matching++;
      }
      return { room, isAvailable: matching >= slotsNeeded };
    })
    .sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      const fa = a.room.floor ?? "9";
      const fb = b.room.floor ?? "9";
      return fa.localeCompare(fb);
    });
}

// JS injected into the WebView to auto-click the requested timeslot
function buildInjectJS(date: string, startTime: string): string {
  const isoPrefix = `${date}T${startTime}:00`;
  return `
(function() {
  function tryClick() {
    var selectors = [
      '[data-date^="${isoPrefix}"]',
      '.s-lc-eq-avail[data-date^="${date}T${startTime.replace(":", "")}"]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && !el.classList.contains('s-lc-eq-checkout') &&
          !el.classList.contains('s-lc-eq-pending')) {
        el.click();
        return true;
      }
    }
    return false;
  }
  if (!tryClick()) {
    setTimeout(tryClick, 1200);
    setTimeout(tryClick, 2800);
  }
})();
true;
  `.trim();
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const days = useMemo(() => getDays(), []);

  const [step, setStep] = useState<Step>("filter");

  const [filters, setFilters] = useState<Filters>({
    date:        days[0]!.value,
    startTime:   "10:00",
    duration:    60,
    groupSize:   2,
    floor:       "any",
    needsPower:  false,
    needsADA:    false,
  });

  // Results state
  const [loading, setLoading]     = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [results, setResults]     = useState<RoomWithSlots[]>([]);

  // Booking state
  const [bookingRoom, setBookingRoom] = useState<LibCalRoom | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);

  // Slide animation between steps
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

  // ── Search ────────────────────────────────────────────────────────────────

  async function handleSearch() {
    setLoading(true);
    setApiError(null);
    setResults([]);
    animateTo(1);
    setStep("results");

    try {
      const rooms = await fetchRoomList();
      const ids = rooms.map((r) => r.id);
      const avail = await fetchAvailability(ids, filters.date);
      const matched = filterAndMatch(rooms, avail, filters);
      setResults(matched);
    } catch (e: any) {
      setApiError(e?.message ?? "Unknown error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // ── Book ──────────────────────────────────────────────────────────────────

  function openBooking(room: LibCalRoom) {
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
    } else {
      setStep("filter");
    }
  }

  const bookingUrl = bookingRoom
    ? `${LIBCAL_BASE}/reserve/spaces/study-rooms?lid=${LID}&eid=${bookingRoom.id}&dt=${filters.date}`
    : "";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: Colors.bg }}
    >
      {/* Back header when not on filter step */}
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
              : bookingRoom?.title ?? "Reserve Room"}
          </Text>
          {step === "results" && (
            <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 11 }}>
              {results.filter((r) => r.isAvailable).length} available
            </Text>
          )}
        </View>
      )}

      <Animated.View
        style={{ flex: 1, transform: [{ translateY: slideAnim }] }}
      >
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
            onOpenDirect={() =>
              Linking.openURL(
                `${LIBCAL_BASE}/reserve/spaces/study-rooms?lid=${LID}&dt=${filters.date}`,
              )
            }
          />
        )}

        {step === "booking" && bookingRoom && (
          <BookingStep
            url={bookingUrl}
            injectJS={buildInjectJS(filters.date, filters.startTime)}
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

// ─── Filter Step ──────────────────────────────────────────────────────────────

interface FilterStepProps {
  days: { value: string; label: string }[];
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onSearch: () => void;
}

function FilterStep({ days, filters, onChange, onSearch }: FilterStepProps) {
  const endTime = addMins(filters.startTime, filters.duration);
  const [searchPressed, setSearchPressed] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={{ color: Colors.text, fontFamily: Fonts.display, fontSize: 28, marginBottom: 4 }}>
        Library Rooms
      </Text>
      <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12, marginBottom: 24 }}>
        Filter your specs — we'll find what's open.
      </Text>

      {/* Date */}
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

      {/* Start time */}
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

      {/* Duration */}
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

      {/* Time window summary */}
      <Text style={{
        color: Colors.muted, fontFamily: Fonts.body, fontSize: 11,
        marginTop: 6, marginBottom: 20,
      }}>
        {to12h(filters.startTime)} – {to12h(endTime)}
      </Text>

      {/* Group size stepper */}
      <FilterLabel icon="users">Group size</FilterLabel>
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1,
        borderRadius: 16, alignSelf: "flex-start", marginBottom: 20, overflow: "hidden",
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

      {/* Floor preference */}
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

      {/* Preferences toggles */}
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

      {/* Search button */}
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

// ─── Results Step ─────────────────────────────────────────────────────────────

interface ResultsStepProps {
  loading: boolean;
  error: string | null;
  results: RoomWithSlots[];
  filters: Filters;
  onBook: (room: LibCalRoom) => void;
  onOpenDirect: () => void;
}

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
          Checking LibCal availability…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Feather name="wifi-off" size={36} color={Colors.muted} style={{ marginBottom: 14 }} />
        <Text style={{
          color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 16,
          textAlign: "center", marginBottom: 8,
        }}>
          Couldn't reach LibCal
        </Text>
        <Text style={{
          color: Colors.muted, fontFamily: Fonts.body, fontSize: 12,
          textAlign: "center", marginBottom: 28, lineHeight: 18,
        }}>
          CPP's LibCal API may require authentication. Open LibCal directly to see availability.
        </Text>
        <Pressable
          onPress={onOpenDirect}
          style={{
            backgroundColor: Colors.accentBg,
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
          <Feather name="external-link" size={15} color={Colors.accent} />
          <Text style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold, fontSize: 13 }}>
            Open LibCal Directly
          </Text>
        </Pressable>
      </View>
    );
  }

  // Filter summary pill
  const summaryParts = [
    to12h(filters.startTime) + " – " + to12h(endTime),
    filters.groupSize + " people",
    filters.floor !== "any" ? `Floor ${filters.floor}` : null,
    filters.needsPower ? "Power" : null,
    filters.needsADA   ? "ADA"   : null,
  ].filter(Boolean).join(" · ");

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 44 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Filter summary */}
      <View style={{
        backgroundColor: Colors.card, borderColor: Colors.border, borderWidth: 1,
        borderRadius: 14, padding: 14, marginBottom: 20,
        flexDirection: "row", alignItems: "center", gap: 10,
      }}>
        <Feather name="filter" size={13} color={Colors.muted} />
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, flex: 1 }}>
          {summaryParts}
        </Text>
      </View>

      {available.length === 0 && unavailable.length === 0 && (
        <View style={{ alignItems: "center", paddingTop: 32 }}>
          <Feather name="inbox" size={34} color={Colors.muted} style={{ marginBottom: 12 }} />
          <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 15, marginBottom: 4 }}>
            No rooms matched
          </Text>
          <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12, textAlign: "center" }}>
            Try adjusting your floor, group size, or preferences.
          </Text>
          <Pressable onPress={onOpenDirect} style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="external-link" size={13} color={Colors.accent} />
            <Text style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold, fontSize: 12 }}>
              Open LibCal directly
            </Text>
          </Pressable>
        </View>
      )}

      {/* Available rooms */}
      {available.length > 0 && (
        <>
          <SectionLabel>Available ({available.length})</SectionLabel>
          {available.map(({ room }) => (
            <RoomCard
              key={room.id}
              room={room}
              available
              onBook={() => onBook(room)}
            />
          ))}
        </>
      )}

      {/* Unavailable rooms — still show with dimmed Book button */}
      {unavailable.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: available.length > 0 ? 24 : 0 }}>
            Unavailable at this time ({unavailable.length})
          </SectionLabel>
          {unavailable.map(({ room }) => (
            <RoomCard
              key={room.id}
              room={room}
              available={false}
              onBook={() => onBook(room)}
            />
          ))}
        </>
      )}

      {/* Direct link footer */}
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

// ─── Booking Step (WebView) ───────────────────────────────────────────────────

interface BookingStepProps {
  url: string;
  injectJS: string;
  room: LibCalRoom;
  filters: Filters;
  ready: boolean;
  onReady: () => void;
}

function BookingStep({ url, injectJS, room, filters, ready, onReady }: BookingStepProps) {
  const endTime = addMins(filters.startTime, filters.duration);

  return (
    <View style={{ flex: 1 }}>
      {/* Booking context strip */}
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
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: Colors.accent,
        }} />
        <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 13, flex: 1 }} numberOfLines={1}>
          {room.title}
        </Text>
        <Text style={{ color: Colors.muted, fontFamily: Fonts.mono, fontSize: 11 }}>
          {to12h(filters.startTime)}–{to12h(endTime)}
        </Text>
      </View>

      {/* Loading overlay */}
      {!ready && (
        <View style={{
          position: "absolute", top: 64, left: 0, right: 0, bottom: 0,
          backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center",
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
        onLoad={onReady}
        style={{ flex: 1, backgroundColor: Colors.bg }}
        onNavigationStateChange={(nav: WebViewNavigation) => {
          // LibCal sends the user to a confirmation page after booking
          if (nav.url.includes("/booking/")) {
            // Booking confirmed — user can see confirmation in WebView
          }
        }}
      />

      {/* SSO note */}
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
        <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>
          Sign in with your CPP account, then press Submit to reserve.
        </Text>
      </View>
    </View>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

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
        color: Colors.muted, fontFamily: Fonts.bodySemiBold,
        fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase",
      }}>
        {children}
      </Text>
    </View>
  );
}

function HScroll({ children }: { children: React.ReactNode }) {
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
        width: 28, height: 17, borderRadius: 9,
        backgroundColor: value ? Colors.accent : Colors.border,
        justifyContent: "center",
        paddingHorizontal: 2,
      }}>
        <View style={{
          width: 13, height: 13, borderRadius: 7,
          backgroundColor: Colors.bg,
          alignSelf: value ? "flex-end" : "flex-start",
        }} />
      </View>
    </Pressable>
  );
}

function SectionLabel({ children, style }: { children: string; style?: object }) {
  return (
    <Text style={[{
      color: Colors.muted, fontFamily: Fonts.bodySemiBold,
      fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase",
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
  room: LibCalRoom;
  available: boolean;
  onBook: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <View style={{
      backgroundColor: Colors.card,
      borderColor: available ? Colors.accentBorder : Colors.border,
      borderWidth: 1,
      borderRadius: 18,
      marginBottom: 10,
      overflow: "hidden",
    }}>
      {/* Status strip */}
      <View style={{
        height: 3,
        backgroundColor: available ? Colors.accent : Colors.border,
      }} />

      <View style={{ padding: 16 }}>
        {/* Title row */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontFamily: Fonts.bodySemiBold, fontSize: 15, marginBottom: 3 }}>
              {room.title}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
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
            </View>
          </View>

          {/* Availability badge */}
          <View style={{
            paddingHorizontal: 10, paddingVertical: 5,
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

        {/* Attribute icons */}
        {(room.hasPower || room.isADA) && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            {room.hasPower && (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: Colors.surface, borderRadius: 8,
                paddingHorizontal: 9, paddingVertical: 5,
                borderColor: Colors.border, borderWidth: 1,
              }}>
                <Feather name="zap" size={11} color={Colors.med} />
                <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>Power</Text>
              </View>
            )}
            {room.isADA && (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 5,
                backgroundColor: Colors.surface, borderRadius: 8,
                paddingHorizontal: 9, paddingVertical: 5,
                borderColor: Colors.border, borderWidth: 1,
              }}>
                <Feather name="check-circle" size={11} color={Colors.low} />
                <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11 }}>ADA</Text>
              </View>
            )}
          </View>
        )}

        {/* Book button */}
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