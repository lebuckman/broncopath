import { useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import BuildingCard from "../../components/building/BuildingCard";
import BuildingCardSkeleton from "../../components/building/BuildingCardSkeleton";
import BuildingDetailSheet from "../../components/building/BuildingDetailSheet";
import SectionLabel from "../../components/ui/SectionLabel";
import NowPill from "../../components/ui/NowPill";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const router = useRouter();
  const { buildings, loading, error } = useBuildings();
  const [roomPressed, setRoomPressed] = useState(false);
  const [routePressed, setRoutePressed] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null,
  );

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1"
      style={{ backgroundColor: Colors.bg }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Text
          className="text-[12px] mb-1"
          style={{ color: Colors.muted, fontFamily: Fonts.body }}
        >
          {getGreeting()}, Bronco
        </Text>
        <Text
          className="text-[26px] mb-6"
          style={{ color: Colors.text, fontFamily: Fonts.display }}
        >
          What's happening now
        </Text>

        {/* Live indicator */}
        <NowPill
          updatedAt={buildings[0]?.updatedAt ?? new Date().toISOString()}
        />

        {/* Campus Overview */}
        <SectionLabel>Quietest Right Now</SectionLabel>
        {loading ? (
          <>
            <View className="gap-2.5 mb-3">
              {[...Array(4)].map((_, i) => <BuildingCardSkeleton key={i} />)}
            </View>
            <View style={{ height: 32, marginBottom: 32 }} />
          </>
        ) : error ? (
          <View className="items-center justify-center py-10 mb-8">
            <Text
              className="text-[13px] mb-1"
              style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
            >
              Couldn't load buildings
            </Text>
            <Text
              className="text-[12px]"
              style={{ color: Colors.muted, fontFamily: Fonts.body }}
            >
              Check your connection and try again
            </Text>
          </View>
        ) : (
          <>
            <View className="gap-2.5 mb-3">
              {[...buildings]
                .filter((b) => b.roomCount >= 8)
                .sort((a, b) => a.occupancy - b.occupancy)
                .slice(0, 4)
                .map((b) => (
                  <BuildingCard
                    key={b.id}
                    name={b.name}
                    code={b.code}
                    percentage={b.occupancy}
                    level={b.level}
                    roomCount={b.roomCount}
                    freeCount={b.freeCount}
                    onPress={() => setSelectedBuilding(b)}
                  />
                ))}
            </View>
            <Pressable
              className="flex-row items-center justify-end mb-8 py-2"
              onPress={() => router.push("/(tabs)/rooms")}
            >
              <Text
                className="text-[12px] mr-1"
                style={{ color: Colors.accent, fontFamily: Fonts.bodySemiBold }}
              >
                See all buildings
              </Text>
              <Feather name="arrow-right" size={12} color={Colors.accent} />
            </Pressable>
          </>
        )}

        {/* Quick Actions */}
        <SectionLabel>Quick Actions</SectionLabel>
        <View className="flex-row gap-2.5">
          <Pressable
            className="flex-1 rounded-xl p-5 border"
            onPress={() => router.push("/(tabs)/rooms")}
            onPressIn={() => setRoomPressed(true)}
            onPressOut={() => setRoomPressed(false)}
            style={{
              backgroundColor: roomPressed ? Colors.cardHover : Colors.accentBg,
              borderColor: Colors.accentBorder,
            }}
          >
            <Feather
              name="grid"
              size={20}
              color={Colors.accent}
              style={{ marginBottom: 8 }}
            />
            <Text
              className="text-sm mb-0.5"
              style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
            >
              Find a Room
            </Text>
            <Text
              className="text-[11px]"
              style={{ color: Colors.muted, fontFamily: Fonts.body }}
            >
              See what's open now
            </Text>
          </Pressable>

          <Pressable
            className="flex-1 rounded-xl p-5 border"
            onPress={() => router.push("/(tabs)/route")}
            onPressIn={() => setRoutePressed(true)}
            onPressOut={() => setRoutePressed(false)}
            style={{
              backgroundColor: routePressed ? Colors.cardHover : Colors.card,
              borderColor: Colors.border,
            }}
          >
            <Feather
              name="map-pin"
              size={20}
              color={Colors.muted}
              style={{ marginBottom: 8 }}
            />
            <Text
              className="text-sm mb-0.5"
              style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
            >
              Plan a Route
            </Text>
            <Text
              className="text-[11px]"
              style={{ color: Colors.muted, fontFamily: Fonts.body }}
            >
              Avoid the crowds
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <BuildingDetailSheet
        building={selectedBuilding}
        visible={selectedBuilding !== null}
        onClose={() => setSelectedBuilding(null)}
      />
    </SafeAreaView>
  );
}
