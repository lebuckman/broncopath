import { useState, useEffect, useRef } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { MaterialIcons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Fonts } from "../../constants/fonts";
import type { Building } from "../../constants/mockData";
import { useBuildings } from "../../hooks/useBuildings";
import { useFavorites } from "../../hooks/useFavorites";
import BuildingCard from "../../components/building/BuildingCard";
import BuildingCardSkeleton from "../../components/building/BuildingCardSkeleton";
import BuildingDetailSheet from "../../components/building/BuildingDetailSheet";
import SectionLabel from "../../components/ui/SectionLabel";
import NowPill from "../../components/ui/NowPill";
import InfoModal from "../../components/ui/InfoModal";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const { scrollToTop } = useLocalSearchParams<{ scrollToTop?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { buildings, loading } = useBuildings();

  useEffect(() => {
    if (scrollToTop) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTop]);
  const { favorites, favoriteBuildingIds } = useFavorites();
  const [roomPressed, setRoomPressed] = useState(false);
  const [routePressed, setRoutePressed] = useState(false);
  const [favoriteSheetBuilding, setFavoriteSheetBuilding] =
    useState<Building | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const favoriteBuildings = buildings?.filter((b) =>
    favoriteBuildingIds.includes(b.id),
  );

  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1"
      style={{ backgroundColor: Colors.bg }}
    >
      <ScrollView
        ref={scrollRef}
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
        <View
          className="mb-6"
          style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
        >
          <Text
            className="text-[26px]"
            style={{ color: Colors.text, fontFamily: Fonts.display }}
          >
            What's happening now
          </Text>
          <Pressable
            onPress={() => setShowInfo(true)}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Feather name="info" size={14} color={Colors.muted} />
          </Pressable>
        </View>

        {/* Live indicator */}
        <NowPill
          updatedAt={buildings[0]?.updatedAt ?? new Date().toISOString()}
        />

        {/* Favorites */}
        <SectionLabel>Your Favorites</SectionLabel>
        {loading ? (
          <View className="gap-2.5 mb-8">
            {[...Array(2)].map((_, i) => (
              <BuildingCardSkeleton key={i} />
            ))}
          </View>
        ) : favorites.length === 0 ? (
          <View className="items-center justify-center py-16 mb-8">
            <MaterialIcons
              name="star-outline"
              size={36}
              color={Colors.muted}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={{
                color: Colors.text,
                fontFamily: Fonts.bodyMedium,
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              No favorites yet
            </Text>
            <Text
              style={{
                color: Colors.muted,
                fontFamily: Fonts.body,
                fontSize: 12,
                textAlign: "center",
              }}
            >
              Tap the ★ next to any room in the{"\n"}Rooms or Map tab to save it
              here.
            </Text>
          </View>
        ) : (
          <View className="gap-2.5 mb-6">
            {favoriteBuildings.map((b) => (
              <BuildingCard
                key={b.id}
                name={b.name}
                code={b.code}
                percentage={b.occupancy}
                level={b.level}
                roomCount={b.roomCount}
                freeCount={b.freeCount}
                onPress={() => setFavoriteSheetBuilding(b)}
              />
            ))}
          </View>
        )}

        {favorites.length > 0 && (
          <Pressable
            className="flex-row items-center justify-end mb-8"
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
        building={favoriteSheetBuilding}
        visible={favoriteSheetBuilding !== null}
        onClose={() => setFavoriteSheetBuilding(null)}
      />

      <InfoModal visible={showInfo} onClose={() => setShowInfo(false)} />
    </SafeAreaView>
  );
}
