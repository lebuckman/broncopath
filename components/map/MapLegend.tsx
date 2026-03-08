import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

const ENTRIES = [
  { dot: Colors.low,  label: 'Quiet'    },
  { dot: Colors.med,  label: 'Moderate' },
  { dot: Colors.high, label: 'Busy'     },
] as const;

export default function MapLegend() {
  return (
    <View style={styles.container}>
      {ENTRIES.map(({ dot, label }) => (
        <View key={label} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    backgroundColor: 'rgba(28,33,40,0.92)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: Colors.muted,
  },
});