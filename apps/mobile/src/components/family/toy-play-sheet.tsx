import { TOY_PLAY_COPY } from '@sproutcue/shared/family-profile';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import type { ToyPlayAsset } from '@/lib/family-data';

import { BulletList, MetaPills, SectionTitle, SheetHeading, StatusLine } from './detail-parts';

type Props = { asset: ToyPlayAsset | null; deleting: boolean; status?: string; onClose: () => void; onDelete: (asset: ToyPlayAsset) => void };

// Web toyPlayDialog: identified toy, goals, materials, prompts, steps, easier/harder, safety, delete.
export function ToyPlaySheet({ asset, deleting, status, onClose, onDelete }: Props) {
  const [showVariations, setShowVariations] = useState(false);
  const copy = asset?.language === 'zh-CN' ? TOY_PLAY_COPY['zh-CN'] : TOY_PLAY_COPY.en;
  const play = asset?.play || {};
  const toy = asset?.toy || {};
  const confidence = (copy.confidence as Record<string, string>)[toy.confidence || ''] || toy.confidence || '';
  return (
    <Sheet
      visible={Boolean(asset)}
      onClose={() => {
        setShowVariations(false);
        onClose();
      }}
      closeLabel={copy.close}
      footer={
        asset ? (
          <>
            <Button label={copy.close} variant="secondary" onPress={onClose} disabled={deleting} fullWidth />
            <Button label={deleting ? copy.deleting : copy.delete} variant="danger" onPress={() => onDelete(asset)} disabled={deleting} fullWidth />
          </>
        ) : null
      }>
      {asset ? (
        <>
          <SheetHeading eyebrow={copy.label} title={play.title || asset.title || 'A new way to play'} summary={play.summary} />
          <MetaPills items={[`${play.durationMinutes || 5} ${copy.duration}`, `${copy.age} ${play.ageRange || `${asset.childAgeMonths || ''} months`}`]} />
          <View style={styles.toy}>
            <View style={styles.toyTile}>
              <Text style={styles.toyIcon}>▧</Text>
            </View>
            <View style={styles.toyBody}>
              <Text style={styles.toyLabel}>{`${copy.identified}${confidence ? ` · ${confidence}` : ''}`}</Text>
              <Text style={styles.toyName}>{toy.name || 'Toy'}</Text>
              {toy.description ? <Text style={styles.toyText}>{toy.description}</Text> : null}
            </View>
          </View>
          {play.developmentalGoals?.length ? (
            <>
              <SectionTitle>{copy.goals}</SectionTitle>
              <MetaPills items={play.developmentalGoals} />
            </>
          ) : null}
          <View style={styles.divider} />
          <SectionTitle>{copy.materials}</SectionTitle>
          <BulletList items={play.materials} />
          <SectionTitle>{copy.prompts}</SectionTitle>
          <BulletList items={play.parentPrompts} quote />
          <SectionTitle>{copy.steps}</SectionTitle>
          <BulletList items={play.steps} ordered />
          <View style={styles.variations}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showVariations }} onPress={() => setShowVariations(!showVariations)} style={styles.variationsHeader}>
              <Text style={styles.variationsTitle}>{copy.variations}</Text>
              <Text style={styles.chevron}>{showVariations ? '▴' : '▾'}</Text>
            </Pressable>
            {showVariations ? (
              <>
                <Text style={styles.variationText}><Text style={styles.bold}>{copy.easier}：</Text> {play.easierVariation || ''}</Text>
                <Text style={styles.variationText}><Text style={styles.bold}>{copy.harder}：</Text> {play.harderVariation || ''}</Text>
              </>
            ) : null}
          </View>
          <View style={styles.safety}>
            <Text style={styles.bold}>{copy.safety}</Text>
            {play.supervision ? <Text style={styles.safetyText}>{play.supervision}</Text> : null}
            <BulletList items={play.safetyNotes} />
          </View>
          <StatusLine text={status} />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  toy: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#f2f6ec', borderWidth: 1, borderColor: '#dce7cf', borderRadius: 18, paddingHorizontal: 17, paddingVertical: 15, marginVertical: Spacing.two },
  toyTile: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  toyIcon: { color: Colors.toyInk, fontSize: 20 },
  toyBody: { flex: 1, gap: 2 },
  toyLabel: { color: Colors.toyInk, fontSize: 12, fontWeight: '700' },
  toyName: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  toyText: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  divider: { height: 1, backgroundColor: Colors.line, marginVertical: Spacing.two },
  variations: { backgroundColor: Colors.variationsBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, gap: 9, marginTop: Spacing.two },
  variationsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  variationsTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  chevron: { color: Colors.muted, fontSize: 14 },
  variationText: { color: Colors.muted, fontSize: 14, lineHeight: 21 },
  bold: { color: Colors.ink, fontWeight: '800' },
  safety: { backgroundColor: Colors.safetyBg, borderLeftWidth: 4, borderLeftColor: Colors.safetyBorder, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 6 },
  safetyText: { color: Colors.muted, fontSize: 14, lineHeight: 21 },
});
