import { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView from 'react-native-maps';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { BUILDINGS } from '../../constants/mockData';
import type { Building } from '../../constants/mockData';
import { CPP_REGION } from '../../constants/campus';
import BuildingMarker from '../../components/map/BuildingMarker';
import MapLegend from '../../components/map/MapLegend';
import BuildingDetailSheet from '../../components/building/BuildingDetailSheet';

export default function MapScreen() {
  const [selected, setSelected] = useState<Building | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);

  function handleMarkerPress(building: Building) {
    setSelected(building);
    setSheetVisible(true);
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: Colors.bg }}>
      {/* Header */}
      <View className="px-5 pt-6 pb-4">
        <Text
          className="text-[26px]"
          style={{ color: Colors.text, fontFamily: Fonts.display }}
        >
          Campus Map
        </Text>
        <Text
          className="text-[12px] mt-1"
          style={{ color: Colors.muted, fontFamily: Fonts.body }}
        >
          Tap any building to explore
        </Text>
      </View>

      {/* Map */}
      <View style={{ flex: 1 }} onLayout={e => setMapHeight(e.nativeEvent.layout.height)}>
        <MapView
          style={{ width: '100%', height: mapHeight }}
          initialRegion={CPP_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {BUILDINGS.map(building => (
            <BuildingMarker
              key={building.id}
              building={building}
              onPress={handleMarkerPress}
            />
          ))}
        </MapView>

        <MapLegend />
      </View>

      <BuildingDetailSheet
        building={selected}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}