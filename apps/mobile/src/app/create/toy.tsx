import { childDisplayName, getChildProfile } from '@sproutcue/shared/profile-defaults';
import { validateAiPhotos } from '@sproutcue/shared/studio';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/components/studio/back-link';
import { PhotoPicker } from '@/components/studio/photo-picker';
import { ChoiceCards, TagGroup } from '@/components/studio/tag-group';
import { Button, Screen } from '@/components/ui';
import { Colors, Radius, Type } from '@/constants/theme';
import type { PickedPhoto } from '@/lib/photo-upload';
import { useSession } from '@/lib/session';
import { useCreateToyPlay } from '@/lib/studio-data';

const COPY = {
  en: {
    eyebrow: 'New play, same toys', heading: 'Show us a toy.\nWe’ll spark a new game.', intro: (name: string) => `Upload one photo and get a simple play idea matched to ${name}’s age.`,
    madeFor: (name: string, months: number) => `Made for ${name} · ${months} months`, hint: 'One toy on a clear surface in good light · JPEG, PNG, WebP, or HEIC up to 20 MB.',
    generate: 'Make a play idea →', how: 'How it works', show: 'Show one toy', showHelp: 'We look only for the main toy—not people, brands, or places.',
    match: 'Get an age-matched idea', matchHelp: (name: string, months: number) => `The plan uses ${name}’s saved age of ${months} months.`,
    wait: 'Wait or leave', waitHelp: 'The plan saves automatically, and we’ll let you know when it is ready.', privacy: 'Your plan is created in the background and saved automatically. Always inspect the toy and supervise play.',
  },
  'zh-CN': {
    eyebrow: '旧玩具，新玩法', heading: '给我们看一个玩具，\n一起发现新玩法。', intro: (name: string) => `上传一张照片，获取适合 ${name} 年龄的简单玩法。`,
    madeFor: (name: string, months: number) => `适合 ${name} · ${months} 个月`, hint: '请把一个玩具放在光线充足、背景清晰的平面上 · 支持 JPEG、PNG、WebP 或 HEIC，最大 20 MB。',
    generate: '生成普通话玩法 →', how: '使用方法', show: '展示一个玩具', showHelp: '我们只识别主要玩具，不识别人脸、品牌或地点。',
    match: '获取适龄玩法', matchHelp: (name: string, months: number) => `玩法会参考 ${name} 保存的年龄：${months} 个月。`,
    wait: '等待或离开', waitHelp: '玩法会自动保存，完成后我们会通知你。', privacy: '玩法会在后台生成并自动保存。完成后请先检查玩具，并在玩耍时全程陪伴。',
  },
} as const;

// Web studioToyPlay: one toy photo → background AI job → saved play idea (opens in Family).
export default function ToyPlayScreen() {
  const { user } = useSession();
  const child = getChildProfile(user);
  const childName = childDisplayName(child);
  const months = Number(child?.ageMonths) || 30;
  const create = useCreateToyPlay();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [language, setLanguage] = useState<'en' | 'zh-CN'>('en');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const copy = COPY[language];

  const submit = async () => {
    const problem = validateAiPhotos(photos, { min: 1, max: 1 });
    if (problem) return setStatus(language === 'zh-CN' ? '请先选择一张清晰的玩具照片。' : problem === 'Choose 1 photo.' ? 'Choose a clear photo of one toy first.' : problem);
    setBusy(true);
    try {
      await create(photos[0], language, setStatus);
      setStatus(language === 'zh-CN' ? '玩法已加入队列，完成后会通知你。' : 'Play idea queued. We’ll let you know when it is ready.');
    } catch (error: any) {
      setStatus(language === 'zh-CN' ? `暂时无法生成玩法：${error?.message || error}` : `Could not make a play idea: ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label={busy ? (language === 'zh-CN' ? '正在生成玩法…' : 'Making your play idea…') : copy.generate} fullWidth loading={busy} disabled={!photos.length} onPress={submit} />}>
      <BackLink label={language === 'zh-CN' ? '返回 Play Studio' : 'Back to Play Studio'} />
      <View>
        <Text style={Type.eyebrow}>{copy.eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>{copy.heading}</Text>
        <Text style={styles.lede}>{copy.intro(childName)}</Text>
        <Text style={styles.age}>{copy.madeFor(childName, months)}</Text>
      </View>

      <View style={styles.card}>
        <PhotoPicker photos={photos} onChange={setPhotos} max={1} hint={copy.hint} disabled={busy} onError={setStatus} />
        <TagGroup legend="Play idea language · 玩法语言">
          <ChoiceCards
            value={language}
            onChange={setLanguage}
            disabled={busy}
            options={[
              { id: 'en', label: 'English', detail: 'Generate in English' },
              { id: 'zh-CN', label: '中文（普通话）', detail: '生成简体中文玩法' },
            ]}
          />
        </TagGroup>
        {status ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}
      </View>

      <View style={styles.how}>
        <Text style={Type.eyebrow}>{copy.how}</Text>
        {[
          [copy.show, copy.showHelp],
          [copy.match, copy.matchHelp(childName, months)],
          [copy.wait, copy.waitHelp],
        ].map(([title, help], index) => (
          <View key={title} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepHelp}>{help}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.privacy}>♡ {copy.privacy}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { color: Colors.ink, fontSize: 36, fontWeight: '800', letterSpacing: -1.8, lineHeight: 38, marginTop: 8, marginBottom: 12 },
  lede: { color: Colors.muted, fontSize: 16, lineHeight: 23 },
  age: { alignSelf: 'flex-start', backgroundColor: Colors.toyTile, color: Colors.toyInk, fontSize: 12, fontWeight: '800', borderRadius: Radius.pill, overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 6, marginTop: 12 },
  card: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.line, borderRadius: 22, padding: 18, gap: 18 },
  status: { color: Colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  how: { backgroundColor: Colors.toyTile, borderRadius: 22, padding: 18, gap: 14 },
  step: { flexDirection: 'row', gap: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: Colors.toyInk, fontWeight: '800' },
  stepTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  stepHelp: { color: Colors.muted, fontSize: 13, lineHeight: 19 },
  privacy: { color: Colors.muted, fontSize: 13, lineHeight: 19 },
});
