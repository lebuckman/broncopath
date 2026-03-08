import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import type { Building, DensityLevel } from '../../constants/mockData';

interface Props {
  building: Building;
  onPress: (building: Building) => void;
}

function markerColors(level: DensityLevel) {
  if (level === 'low') return { bg: Colors.lowBg, border: Colors.low, dot: Colors.low };
  if (level === 'med') return { bg: Colors.medBg, border: Colors.med, dot: Colors.med };
  return { bg: Colors.highBg, border: Colors.high, dot: Colors.high };
}

export default function BuildingMarker({ building, onPress }: Props) {
  const { bg, border, dot } = markerColors(building.level);

  return (
    <Marker
      coordinate={{ latitude: building.latitude, longitude: building.longitude }}
      onPress={() => onPress(building)}
      tracksViewChanges={false}
    >
      <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={styles.label}>{building.code}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.text,
  },
});