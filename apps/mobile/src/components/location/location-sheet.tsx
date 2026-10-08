import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Sheet, TextField } from '@/components/ui';
import { Colors, Spacing, Type } from '@/constants/theme';

type Props = {
  visible: boolean;
  /** The saved location, shown as the current value. */
  currentLabel: string;
  initialAddress: string;
  status: string;
  locating: boolean;
  onLocate: () => Promise<string>;
  onSubmit: (address: string) => Promise<string>;
  onClose: () => void;
};

// Web location tool: use the phone's location, or type a neighborhood, city, or address.
// Opened from the Today location chip (and Discover's "Input address" before a location is set).
export function LocationSheet({ visible, currentLabel, initialAddress, status, locating, onLocate, onSubmit, onClose }: Props) {
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAddress(initialAddress);
      setError('');
    }
  }, [visible, initialAddress]);

  const locate = async () => {
    setError('');
    const message = await onLocate();
    if (!message) onClose();
  };

  const submit = async () => {
    setSaving(true);
    const message = await onSubmit(address);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} closeLabel="Close location form" footer={<Button label="Update location" fullWidth loading={saving} disabled={locating} onPress={submit} />}>
      <View>
        <Text style={Type.eyebrow}>Set your home base</Text>
        <Text accessibilityRole="header" style={styles.title}>Where should we look?</Text>
        <Text style={styles.current}>Now: {currentLabel}</Text>
      </View>
      <Button label="⌖ Use my current location" fullWidth loading={locating} disabled={saving} onPress={locate} accessibilityHint="Asks for location permission and searches near you" />
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or enter a place</Text>
        <View style={styles.line} />
      </View>
      <TextField
        label="Address or place"
        labelVariant="caps"
        value={address}
        onChangeText={setAddress}
        placeholder="Home address, city, or favorite play area"
        autoCapitalize="words"
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        returnKeyType="search"
        onSubmitEditing={submit}
        error={error}
      />
      {status && !error ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}
      <Text style={Type.small}>Saved only to your family profile. Used for weather and nearby results on Today and Discover.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1, marginTop: 6 },
  current: { color: Colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  line: { flex: 1, height: 1, backgroundColor: Colors.line },
  or: { color: Colors.faint, fontSize: 13, fontWeight: '700' },
  status: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
});
