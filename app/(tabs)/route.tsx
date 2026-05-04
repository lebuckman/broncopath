import { useState, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, Modal, TextInput, Dimensions, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import type { Building } from '../../constants/mockData';
import { useBuildings } from '../../hooks/useBuildings';
import RouteInputCard from '../../components/route/RouteInputCard';

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function numFromCode(code: string): number {
  return parseInt(code.replace(/\D/g, ''), 10) || 0;
}

export default function RouteScreen() {
  const { buildings } = useBuildings();
  const { fromId: paramFromId, toId: paramToId } = useLocalSearchParams<{ fromId?: string; toId?: string }>();

  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (paramFromId) {
      setFromId(paramFromId);
      setToId(prev => prev === paramFromId ? null : prev);
    }
  }, [paramFromId]);

  useEffect(() => {
    if (paramToId) {
      setToId(paramToId);
      setFromId(prev => prev === paramToId ? null : prev);
    }
  }, [paramToId]);

  const sortedBuildings = [...buildings].sort((a, b) => numFromCode(a.code) - numFromCode(b.code));
  const filteredBuildings = sortedBuildings.filter(b => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q);
  });

  const fromBuilding = buildings.find(b => b.id === fromId) ?? null;
  const toBuilding = buildings.find(b => b.id === toId) ?? null;
  const bothSelected = !!fromBuilding && !!toBuilding;

  const distanceM = bothSelected
    ? haversineM(fromBuilding.latitude, fromBuilding.longitude, toBuilding.latitude, toBuilding.longitude)
    : 0;
  const walkMinutes = bothSelected ? Math.max(1, Math.ceil(distanceM / 83)) : 0;

  function pickBuilding(building: Building) {
    if (pickerTarget === 'from') {
      setFromId(building.id);
      if (building.id === toId) setToId(null);
    } else {
      setToId(building.id);
      if (building.id === fromId) setFromId(null);
    }
    setPickerTarget(null);
    setSearchQuery('');
  }

  function closePicker() {
    setPickerTarget(null);
    setSearchQuery('');
  }

  function handleSwap() {
    setFromId(toId);
    setToId(fromId);
  }

  function handleOpenMaps() {
    if (!fromBuilding || !toBuilding) return;
    Linking.openURL(
      `maps://?saddr=${fromBuilding.latitude},${fromBuilding.longitude}&daddr=${toBuilding.latitude},${toBuilding.longitude}&dirflg=w`
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: Colors.bg }}>
      {/* Header */}
      <View className="px-5 pt-6 pb-4">
        <Text className="text-[26px]" style={{ color: Colors.text, fontFamily: Fonts.display }}>
          Plan a Route
        </Text>
        <Text className="text-[12px] mt-1" style={{ color: Colors.muted, fontFamily: Fonts.body }}>
          Navigate between campus buildings
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <RouteInputCard
          from={fromBuilding?.name ?? null}
          to={toBuilding?.name ?? null}
          onFromPress={() => setPickerTarget('from')}
          onToPress={() => setPickerTarget('to')}
          onSwap={handleSwap}
        />

        {!bothSelected ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: Colors.accentBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Feather name="navigation" size={30} color={Colors.accent} />
            </View>
            <Text
              className="text-[17px] mb-2 text-center"
              style={{ color: Colors.text, fontFamily: Fonts.bodyMedium }}
            >
              Where are you headed?
            </Text>
            <Text
              className="text-[13px] text-center"
              style={{ color: Colors.muted, fontFamily: Fonts.body, maxWidth: 260 }}
            >
              Select a start and destination above for walking directions via Apple Maps.
            </Text>
          </View>
        ) : (
          <>
            {/* Vertical summary card */}
            <View
              className="rounded-2xl border p-5 mb-4"
              style={{ backgroundColor: Colors.card, borderColor: Colors.border }}
            >
              {/* From */}
              <View>
                <Text
                  style={{
                    color: Colors.muted,
                    fontFamily: Fonts.body,
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  From
                </Text>
                <Text
                  style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 15 }}
                  numberOfLines={1}
                >
                  {fromBuilding.name}
                </Text>
                <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginTop: 2 }}>
                  {fromBuilding.code}
                </Text>
              </View>

              {/* Connector */}
              <View style={{ alignItems: 'flex-start', paddingLeft: 4, paddingVertical: 10 }}>
                <View style={{ width: 1, height: 12, backgroundColor: Colors.border, marginLeft: 9 }} />
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: Colors.accentBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginVertical: 4,
                  }}
                >
                  <Feather name="arrow-down" size={11} color={Colors.accent} />
                </View>
                <View style={{ width: 1, height: 12, backgroundColor: Colors.border, marginLeft: 9 }} />
              </View>

              {/* To */}
              <View>
                <Text
                  style={{
                    color: Colors.muted,
                    fontFamily: Fonts.body,
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  To
                </Text>
                <Text
                  style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 15 }}
                  numberOfLines={1}
                >
                  {toBuilding.name}
                </Text>
                <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginTop: 2 }}>
                  {toBuilding.code}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: Colors.border, marginTop: 16, marginBottom: 14 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="map-pin" size={12} color={Colors.muted} />
                <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 12 }}>
                  {Math.round(distanceM)} m apart (straight line)
                </Text>
              </View>
            </View>

            <Pressable
              className="rounded-xl p-4 items-center flex-row justify-center gap-2"
              style={{ backgroundColor: Colors.accent }}
              onPress={handleOpenMaps}
            >
              <Feather name="navigation" size={16} color={Colors.bg} />
              <Text className="text-sm" style={{ color: Colors.bg, fontFamily: Fonts.bodySemiBold }}>
                Open in Apple Maps
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Building picker modal */}
      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
        statusBarTranslucent
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            paddingHorizontal: 32,
            paddingVertical: 60,
          }}
          onPress={closePicker}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: Colors.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: Colors.borderMd,
              maxHeight: Dimensions.get('window').height * 0.6,
              overflow: 'hidden',
            }}
          >
            <Text
              style={{
                color: Colors.muted,
                fontFamily: Fonts.bodySemiBold,
                fontSize: 11,
                letterSpacing: 1,
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 8,
                textTransform: 'uppercase',
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              {pickerTarget === 'from' ? 'Select start' : 'Select destination'}
            </Text>

            {/* Search input */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: Colors.surface,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  gap: 6,
                }}
              >
                <Feather name="search" size={13} color={Colors.muted} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search buildings…"
                  placeholderTextColor={Colors.muted}
                  style={{
                    flex: 1,
                    color: Colors.text,
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    padding: 0,
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {filteredBuildings.map((b, i) => {
                const isDisabled =
                  (pickerTarget === 'from' && b.id === toId) ||
                  (pickerTarget === 'to' && b.id === fromId);
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => !isDisabled && pickBuilding(b)}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: i < filteredBuildings.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.border,
                      opacity: isDisabled ? 0.35 : 1,
                    }}
                  >
                    <Text style={{ color: Colors.text, fontFamily: Fonts.bodyMedium, fontSize: 14 }}>
                      {b.name}
                    </Text>
                    <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 11, marginTop: 2 }}>
                      {b.code}
                    </Text>
                  </Pressable>
                );
              })}
              {filteredBuildings.length === 0 && (
                <View style={{ paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={{ color: Colors.muted, fontFamily: Fonts.body, fontSize: 13 }}>
                    No buildings found
                  </Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
