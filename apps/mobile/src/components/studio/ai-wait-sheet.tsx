import { aiJobIsDone, aiJobProgressPercent, aiJobRemainingSeconds, aiJobTimeLabel, aiUsageLabel } from '@sproutcue/shared/studio';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { Colors, Radius, Shadow, Type } from '@/constants/theme';
import type { AiJob, AiUsage } from '@/lib/ai-jobs';

type Props = { visible: boolean; job: AiJob | null; usage: AiUsage; error: string; onLeave: () => void; onOpen: () => void };

// Web .ai-wait-dialog as a bottom sheet: pulsing orbit, countdown, progress bar, then "Open creation".
export function AiWaitSheet({ visible, job, usage, error, onLeave, onOpen }: Props) {
  const insets = useSafeAreaInsets();
  const done = job?.status === 'succeeded';
  const failed = job?.status === 'failed';
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || aiJobIsDone(job?.status)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible, job?.status]);

  useEffect(() => {
    if (!visible || done || failed) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, done, failed, pulse]);

  if (!job) return null;
  const usageText = aiUsageLabel(usage);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onLeave} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={done || failed ? undefined : onLeave} accessibilityLabel="Leave and get notified" />
      <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]} accessibilityViewIsModal>
        <Animated.View style={[styles.orbit, done && styles.orbitDone, failed && styles.orbitFailed, { transform: [{ scale: pulse }] }]}>
          <Text style={[styles.orbitIcon, done && styles.orbitIconDone, failed && styles.orbitIconFailed]}>{done ? '✓' : failed ? '!' : '✦'}</Text>
        </Animated.View>
        <Text style={[Type.eyebrow, styles.center]}>{done ? 'Creation complete' : failed ? 'Creation paused' : 'AI is creating'}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {done ? job.result?.title || 'Your new creation is ready' : failed ? 'We couldn’t finish this creation' : 'Making something special…'}
        </Text>
        <Text style={styles.copy} accessibilityLiveRegion="polite">
          {done ? 'Your new family asset is ready to open.' : failed ? job.error || 'Please try again.' : 'You can stay here, or leave this screen. We’ll let you know when it’s ready.'}
        </Text>
        {!done && !failed ? (
          <>
            <View style={styles.countdown} accessible accessibilityLabel={`About ${aiJobTimeLabel(aiJobRemainingSeconds(job, now))} remaining`}>
              <Text style={styles.time}>{aiJobTimeLabel(aiJobRemainingSeconds(job, now))}</Text>
              <Text style={styles.small}>estimated time remaining</Text>
            </View>
            <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: aiJobProgressPercent(job) }}>
              <LinearGradient colors={['#86a26e', '#e6a14b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${aiJobProgressPercent(job)}%` }]} />
            </View>
          </>
        ) : null}
        {usageText ? <Text style={[styles.small, styles.center]}>{usageText}</Text> : null}
        <View style={styles.actions}>
          {done ? (
            <Button label="Open creation" onPress={onOpen} fullWidth />
          ) : failed ? (
            <Button label="Close" onPress={onLeave} fullWidth />
          ) : (
            <Button label="Leave and notify me" variant="secondary" onPress={onLeave} fullWidth />
          )}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

// Shown when a creation finishes after the family left the progress sheet.
export function AiCompletionToast({ job, onOpen, onDismiss }: { job: AiJob; onOpen: () => void; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const failed = job.status === 'failed';
  return (
    <View style={[styles.toast, { bottom: 96 + insets.bottom }]} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      <View style={[styles.toastIcon, failed && styles.orbitFailed]}>
        <Text style={[styles.toastIconText, failed && styles.orbitIconFailed]}>{failed ? '!' : '✓'}</Text>
      </View>
      <View style={styles.toastCopy}>
        <Text style={styles.toastTitle} numberOfLines={1}>{failed ? 'A creation couldn’t finish' : job.result?.title || 'Your creation is ready'}</Text>
        <Text style={styles.toastText} numberOfLines={1}>{failed ? job.error || 'Please try again.' : 'Tap to open it'}</Text>
      </View>
      {failed ? null : (
        <Pressable accessibilityRole="button" onPress={onOpen} hitSlop={6} style={({ pressed }) => [styles.toastOpen, pressed && { opacity: 0.7 }]}>
          <Text style={styles.toastOpenText}>Open</Text>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={8} style={styles.toastClose}>
        <Text style={styles.toastCloseText}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: Colors.overlay },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 30, alignItems: 'center', ...Shadow.float },
  orbit: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#edf3e5', borderWidth: 1, borderColor: '#d6e3c8', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  orbitDone: { backgroundColor: '#e7f4e8' },
  orbitFailed: { backgroundColor: '#fff0e8', borderColor: '#f3d2c2' },
  orbitIcon: { fontSize: 32, color: '#587145' },
  orbitIconDone: { color: '#39724d' },
  orbitIconFailed: { color: '#b9512f' },
  center: { textAlign: 'center' },
  title: { color: Colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -1.3, lineHeight: 32, textAlign: 'center', marginTop: 8, marginBottom: 10 },
  copy: { color: Colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 410 },
  countdown: { alignItems: 'center', gap: 3, marginTop: 22, marginBottom: 12 },
  time: { color: Colors.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  small: { color: Colors.muted, fontSize: 12 },
  track: { width: '100%', maxWidth: 360, height: 7, borderRadius: Radius.pill, backgroundColor: '#eee9df', overflow: 'hidden', marginBottom: 12 },
  fill: { height: 7, borderRadius: Radius.pill },
  actions: { alignSelf: 'stretch', marginTop: 20 },
  error: { color: Colors.dangerWeb, fontSize: 13, marginTop: 10, textAlign: 'center' },
  toast: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: 18, paddingVertical: 10, paddingLeft: 12, paddingRight: 6, ...Shadow.float },
  toastIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e7f4e8', alignItems: 'center', justifyContent: 'center' },
  toastIconText: { color: '#39724d', fontSize: 18, fontWeight: '800' },
  toastCopy: { flex: 1, minWidth: 0 },
  toastTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  toastText: { color: Colors.muted, fontSize: 12 },
  toastOpen: { backgroundColor: Colors.brand, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  toastOpenText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  toastClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  toastCloseText: { color: Colors.muted, fontSize: 22 },
});
