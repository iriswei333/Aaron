import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type GreetingProps = {
  locationLabel: string;
  childName: string;
  parentName: string;
  weather: { label?: string; temperature?: string };
  weatherIcon: string;
  onLocationPress: () => void;
};

// Web .today-greeting (phone layout): location pill, eyebrow, big question, lede, weather card below.
export function TodayGreeting({ locationLabel, childName, parentName, weather, weatherIcon, onLocationPress }: GreetingProps) {
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Location: ${locationLabel}`} accessibilityHint="Change where SproutCue looks for weather and nearby places" onPress={onLocationPress} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
        <Text style={styles.pillText} numberOfLines={1}>⌖ {locationLabel}</Text>
      </Pressable>
      <Text style={Type.eyebrow}>Little adventures, together</Text>
      <Text accessibilityRole="header" style={styles.title}>{`What shall we do\nwith ${childName} today?`}</Text>
      <Text style={styles.lede}>{`A nearby adventure. A new way to play.\nA little less planning for you, ${parentName}.`}</Text>
      <View style={styles.weather} accessible accessibilityLabel={`Weather: ${weather.temperature || '--'}, ${weather.label || 'loading'}`}>
        <Text style={styles.weatherIcon}>{weatherIcon}</Text>
        <View>
          <Text style={styles.temp}>{weather.temperature || '--'}</Text>
          <Text style={styles.weatherLabel}>{weather.label || 'Weather loading'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: Colors.brandSoft,
    borderWidth: 1,
    borderColor: Colors.locationPillBorder,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
    minHeight: 36,
    justifyContent: 'center',
  },
  pillPressed: { backgroundColor: '#ffe3cf' },
  pillText: { color: Colors.brandStrong, fontSize: 12, fontWeight: '700' },
  title: { color: Colors.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1.8, lineHeight: 40, marginTop: 12, marginBottom: 18 },
  lede: { color: Colors.muted, fontSize: 16, lineHeight: 25 },
  weather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 18,
    backgroundColor: Colors.weatherBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  weatherIcon: { fontSize: 26 },
  temp: { color: Colors.sprout, fontSize: 20, fontWeight: '800' },
  weatherLabel: { color: Colors.rowMeta, fontSize: 11 },
});
