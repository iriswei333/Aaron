import { childAgeLabel, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { formatPlayDateWindow, pendingPlayDateUpdate, playDateRole, sharedPlayDateCapacity, sharedPlayDateWhen } from '@sproutcue/shared/playdates';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlanCard } from '@/components/playdates/plan-card';
import { PlaydateFormSheet } from '@/components/playdates/playdate-form-sheet';
import { UpdateBanner } from '@/components/playdates/update-banner';
import { Button, Screen } from '@/components/ui';
import { Colors, Layout, Type } from '@/constants/theme';
import type { PlayDate } from '@/lib/family-data';
import { sharePlaydateCalendar, sharePlaydateLink, usePlaydate } from '@/lib/playdates';
import { useSession } from '@/lib/session';

// One playdate — the web shared invitation page (renderSharedPlayDate) plus the host and guest
// actions from the web playdate card (renderPlayDateCard): join, can't attend, keep attending,
// edit, share, cancel, and add to calendar. Opened from Discover, the Family tab,
// and links like sproutcue://playdate/<id>.
export default function PlaydateScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const data = usePlaydate(String(id));
  const [editing, setEditing] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const playDate = data.playDate;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/discover'));

  const share = async () => {
    if (!playDate) return;
    try {
      const shared = await sharePlaydateLink(playDate);
      if (shared && Platform.OS === 'web' && typeof (globalThis.navigator as any)?.share !== 'function') data.setMessage('Share link copied to your clipboard.');
    } catch (error: any) {
      if (error?.name !== 'AbortError') data.setMessage('Could not share the playdate link.');
    }
  };

  const addToCalendar = async () => {
    if (!playDate) return;
    setCalendarBusy(true);
    try {
      await sharePlaydateCalendar(playDate);
    } catch (error: any) {
      data.setMessage(error?.message || 'Could not create the calendar invite.');
    } finally {
      setCalendarBusy(false);
    }
  };

  const confirmCancel = () => {
    const text = 'Cancel this public play date? Attending families will be notified.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(text)) data.cancel();
      return;
    }
    Alert.alert('Cancel playdate?', 'Attending families will be notified.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel playdate', style: 'destructive', onPress: () => data.cancel() },
    ]);
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={back} hitSlop={8} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Text style={styles.backText}>← Back to playdates</Text>
      </Pressable>

      {data.status === 'loading' && !playDate ? (
        <View style={[styles.main, styles.center]}>
          <Text style={Type.eyebrow}>Shared invitation</Text>
          <Text style={[styles.title, styles.centerText]}>Loading the playdate…</Text>
          <Text style={[styles.lede, styles.centerText]}>Getting the details so your family can decide if it feels like a good fit.</Text>
          <ActivityIndicator color={Colors.brand} />
        </View>
      ) : !playDate ? (
        <View style={[styles.main, styles.center]}>
          <Text style={Type.eyebrow}>Shared invitation</Text>
          <Text style={[styles.title, styles.centerText]}>We couldn’t find that playdate.</Text>
          <Text style={[styles.lede, styles.centerText]}>It may have ended, been cancelled, or filled up. Browse nearby playdates to find another easy plan.</Text>
          <Button label="Explore playdates" onPress={() => router.replace('/discover')} style={styles.centerButton} />
        </View>
      ) : (
        <PlaydateDetail
          playDate={playDate}
          busy={data.busy}
          message={data.message}
          update={pendingPlayDateUpdate(playDate, data.acknowledged)}
          onAcknowledge={data.acknowledgeUpdate}
          onJoin={data.join}
          onDecline={() => data.respond('declined')}
          onKeep={() => data.respond('joined')}
          onEdit={() => setEditing(true)}
          onShare={share}
          onCancel={confirmCancel}
          onCalendar={addToCalendar}
          calendarBusy={calendarBusy}
        />
      )}

      <PlaydateFormSheet
        placeName={null}
        editing={editing ? playDate : null}
        ageLabel={childAgeLabel(getChildProfile(user))}
        onSubmit={data.save}
        onClose={() => setEditing(false)}
      />
    </Screen>
  );
}

type DetailProps = {
  playDate: PlayDate;
  busy: boolean;
  message: string;
  update: string;
  onAcknowledge: () => void;
  onJoin: () => void;
  onDecline: () => void;
  onKeep: () => void;
  onEdit: () => void;
  onShare: () => void;
  onCancel: () => void;
  onCalendar: () => void;
  calendarBusy: boolean;
};

function PlaydateDetail({ playDate, busy, message, update, onAcknowledge, onJoin, onDecline, onKeep, onEdit, onShare, onCancel, onCalendar, calendarBusy }: DetailProps) {
  const role = playDateRole(playDate);
  const when = sharedPlayDateWhen(playDate);
  const host = role === 'host-public' || role === 'host-private';
  const place = playDate.playgroundName || 'the playground';
  const copy =
    role === 'cancelled'
      ? { kicker: 'Cancelled', eyebrow: 'Plans changed', title: 'This playdate was cancelled.', lede: playDate.lastChangeSummary || 'This play date was cancelled by the host.' }
      : host
        ? {
            kicker: role === 'host-public' ? 'You’re hosting · Public' : 'You’re hosting · Private',
            eyebrow: 'Your playdate',
            title: `Playdate at ${place}`,
            lede: role === 'host-public' ? 'Share the invite so nearby families can join. Changes you make are shared with everyone attending.' : 'Only your family can see this playdate.',
          }
        : { kicker: 'Shared by a nearby family', eyebrow: 'Your kid’s next friend could be closer than you think', title: 'Make room for an easy hello.', lede: '' };

  return (
    <>
      {update ? <UpdateBanner summary={update} when={formatPlayDateWindow(playDate)} onDismiss={onAcknowledge} /> : null}

      <View style={[styles.main, role === 'cancelled' && styles.cancelled]}>
        <View style={styles.kicker}>
          <View style={[styles.liveDot, role === 'cancelled' && styles.liveDotOff]} />
          <Text style={styles.kickerText}>{copy.kicker}</Text>
        </View>
        <Text style={Type.eyebrow}>{copy.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
        {copy.lede ? (
          <Text style={styles.lede}>{copy.lede}</Text>
        ) : (
          <Text style={styles.lede}>
            A family is planning a low-key meetup at <Text style={styles.strong}>{place}</Text>. Join if it fits your day.
          </Text>
        )}

        <View style={styles.details} accessible accessibilityLabel={`${when.date}, ${when.time}`}>
          <View style={styles.dateTile}>
            <Text style={styles.dateTileText}>✦</Text>
          </View>
          <View style={styles.detailCopy}>
            <Text style={styles.detailStrong}>{when.date}</Text>
            {when.time ? <Text style={styles.detailMeta}>{when.time}</Text> : null}
          </View>
        </View>
        <View style={styles.location} accessible accessibilityLabel={`${place}, ${playDate.playgroundAddress || playDate.playgroundType || 'Neighborhood playground'}`}>
          <Text style={styles.pin}>⌖</Text>
          <View style={styles.detailCopy}>
            <Text style={styles.detailStrong}>{place}</Text>
            <Text style={styles.detailMeta}>{playDate.playgroundAddress || playDate.playgroundType || 'Neighborhood playground'}</Text>
          </View>
        </View>
        {playDate.notes ? <Text style={styles.note}>“{playDate.notes}”</Text> : null}

        <View style={styles.actions}>
          <Actions role={role} busy={busy} onJoin={onJoin} onDecline={onDecline} onKeep={onKeep} onEdit={onEdit} onShare={onShare} onCancel={onCancel} />
        </View>
        {message ? <Text style={styles.status} accessibilityLiveRegion="polite">{message}</Text> : null}
        {!host && role !== 'cancelled' ? <Text style={styles.privacy}>Only your family profile is shared with the host after you join.</Text> : null}
      </View>

      <PlanCard capacity={sharedPlayDateCapacity(playDate)} ageRange={playDate.ageRange || ''} onCalendar={role === 'cancelled' ? undefined : onCalendar} calendarBusy={calendarBusy} />
    </>
  );
}

type ActionProps = { role: ReturnType<typeof playDateRole>; busy: boolean; onJoin: () => void; onDecline: () => void; onKeep: () => void; onEdit: () => void; onShare: () => void; onCancel: () => void };

// Web renderPlayDateCard / renderSharedPlayDate action buttons.
function Actions({ role, busy, onJoin, onDecline, onKeep, onEdit, onShare, onCancel }: ActionProps) {
  switch (role) {
    case 'host-public':
      return (
        <>
          <Button label="Share invite ↗" onPress={onShare} fullWidth disabled={busy} accessibilityHint="Opens the share sheet with the invitation link" />
          <View style={styles.row}>
            <Button label="Edit" variant="secondary" onPress={onEdit} disabled={busy} style={styles.flex} />
            <Button label="Cancel playdate" variant="danger" onPress={onCancel} disabled={busy} style={styles.flex} />
          </View>
        </>
      );
    case 'host-private':
      return <Button label="Hosting" variant="secondary" disabled />;
    case 'joined':
      return (
        <View style={styles.rowCenter}>
          <Button label="Can’t attend" variant="secondary" onPress={onDecline} loading={busy} />
          <Text style={styles.confirm}>✓ You’re on the guest list</Text>
        </View>
      );
    case 'declined':
      return <Button label="Keep attending" onPress={onKeep} loading={busy} fullWidth />;
    case 'can-join':
      return <Button label="Join this playdate →" onPress={onJoin} loading={busy} fullWidth />;
    case 'full':
      return <Button label="This playdate is full" variant="secondary" disabled fullWidth />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: Layout.minTouch, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  backText: { color: Colors.brandStrong, fontSize: 15, fontWeight: '800' },
  main: { backgroundColor: Colors.inviteBg, borderWidth: 1, borderColor: Colors.inviteBorder, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 28 },
  cancelled: { opacity: 0.85 },
  center: { alignItems: 'center', gap: 10 },
  centerText: { textAlign: 'center' },
  centerButton: { alignSelf: 'center', marginTop: 8 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 26 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.inviteLive, boxShadow: `0 0 0 4px ${Colors.inviteLiveHalo}` } as any,
  liveDotOff: { backgroundColor: Colors.dangerWeb, boxShadow: 'none' } as any,
  kickerText: { color: Colors.inviteKicker, fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: Colors.inviteTitle, fontSize: 44, fontWeight: '800', letterSpacing: -2.6, lineHeight: 42, marginTop: 12, marginBottom: 16 },
  lede: { color: Colors.muted, fontSize: 17, lineHeight: 25 },
  strong: { color: Colors.ink, fontWeight: '800' },
  details: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: Colors.inviteDivider, marginTop: 26, paddingTop: 20 },
  dateTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.inviteDateTile, alignItems: 'center', justifyContent: 'center' },
  dateTileText: { color: Colors.inviteDateInk, fontSize: 20 },
  detailCopy: { flex: 1, gap: 2 },
  detailStrong: { color: Colors.inviteStrong, fontSize: 16, fontWeight: '800' },
  detailMeta: { color: Colors.inviteMeta, fontSize: 14 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  pin: { width: 40, textAlign: 'center', color: Colors.invitePin, fontSize: 24 },
  note: { backgroundColor: Colors.inviteNoteBg, borderRadius: 13, color: Colors.inviteNoteInk, fontSize: 15, lineHeight: 21, marginTop: 22, paddingHorizontal: 16, paddingVertical: 14 },
  actions: { marginTop: 28, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  rowCenter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  flex: { flex: 1, alignSelf: 'stretch' },
  confirm: { color: Colors.inviteConfirm, fontSize: 14, fontWeight: '800' },
  status: { color: Colors.muted, fontSize: 14, lineHeight: 20, marginTop: 14 },
  privacy: { color: Colors.invitePrivacy, fontSize: 12, marginTop: 18 },
});
