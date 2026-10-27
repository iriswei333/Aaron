import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { confirmUnblock, listBlockedFamilies, unblockFamily, type BlockedFamily } from '@/lib/blocks';
import { useChat } from '@/lib/chat';
import { haptics } from '@/lib/haptics';

// "Blocked families" in the Family tab's account sheet: who you've blocked, with Unblock.
// Mounted while the sheet is open, so it loads fresh each time.
export function BlockedFamilies() {
  const chat = useChat();
  const [blocks, setBlocks] = useState<BlockedFamily[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setBlocks(await listBlockedFamilies());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    listBlockedFamilies()
      .then((items) => {
        if (!active) return;
        setBlocks(items);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const unblock = (family: BlockedFamily) =>
    confirmUnblock(family.displayName, async () => {
      setBusyId(family.userId);
      setError('');
      try {
        await unblockFamily(family.userId);
        haptics.success();
        setBlocks((current) => current.filter((item) => item.userId !== family.userId));
        void chat.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not unblock. Please try again.');
        haptics.error();
      } finally {
        setBusyId('');
      }
    });

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={Type.label}>Blocked families</Text>
      {status === 'loading' ? (
        <ActivityIndicator color={Colors.brand} style={styles.loader} />
      ) : status === 'error' ? (
        <View style={styles.row}>
          <Text style={[Type.small, styles.flex]}>Couldn’t load blocked families.</Text>
          <Button label="Try again" variant="secondary" size="sm" onPress={load} />
        </View>
      ) : blocks.length ? (
        blocks.map((family) => (
          <View key={family.userId} style={styles.row}>
            <Avatar name={family.displayName} size={32} />
            <Text style={styles.name} numberOfLines={1}>{family.displayName}</Text>
            <Button
              label="Unblock"
              variant="secondary"
              size="sm"
              loading={busyId === family.userId}
              disabled={Boolean(busyId)}
              accessibilityHint={`Lets you see ${family.displayName}’s messages again`}
              onPress={() => unblock(family)}
            />
          </View>
        ))
      ) : (
        <Text style={Type.small}>You haven’t blocked anyone. To block a family, long-press one of their messages, or use ⋯ in a direct chat.</Text>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two, marginTop: Spacing.two, paddingTop: Spacing.three, borderTopWidth: 1, borderTopColor: Colors.line },
  loader: { alignSelf: 'flex-start', marginVertical: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.rowBorder,
    backgroundColor: Colors.rowBg,
  },
  flex: { flex: 1 },
  name: { flex: 1, color: Colors.ink, fontSize: 16, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: 13, fontWeight: '700' },
});
