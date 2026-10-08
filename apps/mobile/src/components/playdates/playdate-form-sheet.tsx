import {
  dateInputValue,
  defaultPlayDateWindow,
  localDatePart,
  localTimePart,
  minutesToTimeValue,
  playDateWindowFromForm,
  timeValueToMinutes,
} from '@sproutcue/shared/playdates';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, ChipRow, Sheet, Stepper, TextField } from '@/components/ui';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { PlayDate } from '@/lib/family-data';
import type { PlayDateForm } from '@/lib/playdates';

type Props = {
  /** Open the sheet for this playground (create) … */
  placeName: string | null;
  /** … or prefilled from this playdate (edit; public playdates only, like the web). */
  editing?: PlayDate | null;
  ageLabel: string;
  onSubmit: (form: PlayDateForm) => Promise<boolean | void>;
  onClose: () => void;
};

const EARLIEST = 6 * 60;
const LATEST_END = 23 * 60 + 30;

function timeLabel(minutes: number) {
  return new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const roundToHalfHour = (minutes: number) => Math.round(minutes / 30) * 30;
const clampStart = (minutes: number) => Math.max(EARLIEST, Math.min(minutes, LATEST_END - 30));

function dayLabel(value: string, index: number) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function nextDays(count: number, include?: string) {
  const today = new Date();
  const days = Array.from({ length: count }, (_, index) => {
    const value = dateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() + index));
    return { value, label: dayLabel(value, index) };
  });
  if (include && !days.some((day) => day.value === include)) days.push({ value: include, label: dayLabel(include, 99) });
  return days;
}

// Web create-playdate dialog and edit dialog: day, start / end, public or private, age range, max families, notes.
export function PlaydateFormSheet({ placeName, editing, ageLabel, onSubmit, onClose }: Props) {
  const open = Boolean(placeName || editing);
  const editingDate = editing?.startsAt ? localDatePart(editing.startsAt) : '';
  const days = useMemo(() => nextDays(8, editingDate), [editingDate]);
  const [date, setDate] = useState('');
  const [start, setStart] = useState(15 * 60);
  const [end, setEnd] = useState(16 * 60 + 30);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [ageRange, setAgeRange] = useState('');
  const [maxFamilies, setMaxFamilies] = useState(1);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Fresh values each time the sheet opens: the playdate being edited, or the web defaults
  // (next half hour, 90 minutes).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const startMinutes = timeValueToMinutes(localTimePart(editing.startsAt)) ?? 15 * 60;
      const endMinutes = timeValueToMinutes(localTimePart(editing.endsAt)) ?? startMinutes + 90;
      setDate(editingDate);
      setStart(clampStart(roundToHalfHour(startMinutes)));
      setEnd(Math.min(LATEST_END, Math.max(roundToHalfHour(startMinutes) + 30, roundToHalfHour(endMinutes))));
      setVisibility('public');
      setAgeRange(editing.ageRange || '');
      setMaxFamilies(Number(editing.maxFamilies) >= 2 ? Number(editing.maxFamilies) : 1);
      setNotes(editing.notes || '');
    } else {
      const defaults = defaultPlayDateWindow();
      const startMinutes = clampStart(roundToHalfHour(timeValueToMinutes(defaults.startTime) ?? 15 * 60));
      setDate(defaults.date);
      setStart(startMinutes);
      setEnd(Math.min(LATEST_END, Math.max(startMinutes + 30, roundToHalfHour(timeValueToMinutes(defaults.endTime) ?? startMinutes + 90))));
      setVisibility('public');
      setAgeRange('');
      setMaxFamilies(1);
      setNotes('');
    }
    setStatus('');
  }, [open, editing, editingDate]);

  const changeStart = (value: number) => {
    setStart(value);
    if (end <= value) setEnd(Math.min(LATEST_END, value + 60));
  };

  const submit = async () => {
    setSaving(true);
    setStatus(editing ? 'Saving play date changes…' : 'Creating play date…');
    try {
      const window = playDateWindowFromForm(date, minutesToTimeValue(start), minutesToTimeValue(end));
      const ok = await onSubmit({ ...window, visibility, ageRange, maxFamilies: maxFamilies >= 2 ? String(maxFamilies) : '', notes });
      if (ok === false) setStatus('');
      else onClose();
    } catch (error: any) {
      setStatus(`Could not ${editing ? 'update' : 'create'} play date: ${error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      closeLabel={editing ? 'Close edit play date' : 'Close create playdate'}
      footer={<Button label={editing ? 'Save changes' : 'Create play date'} fullWidth loading={saving} onPress={submit} />}>
      <View>
        <Text style={Type.eyebrow}>{editing ? 'Public play date' : visibility === 'public' ? 'New public playdate' : 'New private playdate'}</Text>
        <Text accessibilityRole="header" style={styles.title}>{editing ? 'Edit play date' : `Plan at ${placeName}`}</Text>
        <Text style={styles.lede}>{editing ? 'Attending families will see a summary of the change.' : 'Invite nearby families or keep this meetup private.'}</Text>
      </View>

      <Field label="Day">
        <ChipRow>
          {days.map((day) => (
            <Chip key={day.value} label={day.label} selected={date === day.value} onPress={() => setDate(day.value)} />
          ))}
        </ChipRow>
      </Field>
      <Field label="Starts">
        <Stepper label="Start time" value={start} min={EARLIEST} max={LATEST_END - 30} step={30} format={timeLabel} onChange={changeStart} />
      </Field>
      <Field label="Ends">
        <Stepper label="End time" value={end} min={start + 30} max={LATEST_END} step={30} format={timeLabel} onChange={setEnd} />
      </Field>
      <Field label="Who can see it">
        {editing ? (
          <View style={styles.locked}>
            <Text style={styles.lockedText}>Public — visible to nearby families</Text>
          </View>
        ) : (
          <ChipRow>
            <Chip label="Public — nearby families" selected={visibility === 'public'} onPress={() => setVisibility('public')} />
            <Chip label="Private — only us" selected={visibility === 'private'} onPress={() => setVisibility('private')} />
          </ChipRow>
        )}
      </Field>
      <TextField label="Age range" labelVariant="caps" value={ageRange} onChangeText={setAgeRange} placeholder={ageLabel ? `Around ${ageLabel}` : 'Ages 2-4'} maxLength={40} />
      <Field label="Max families">
        <Stepper label="Max families" value={maxFamilies} min={1} max={20} format={(value) => (value < 2 ? 'No limit' : String(value))} onChange={setMaxFamilies} />
      </Field>
      <TextField
        label="Notes"
        labelVariant="caps"
        value={notes}
        onChangeText={setNotes}
        placeholder="Splash pad, snacks, stroller-friendly meetup spot"
        maxLength={240}
        multiline
        style={styles.notes}
      />
      {status ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={Type.caps}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: Colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -1, lineHeight: 31, marginTop: 6 },
  lede: { color: Colors.muted, fontSize: 15, lineHeight: 21, marginTop: 6 },
  field: { gap: Spacing.two },
  locked: { borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: Radius.sm, backgroundColor: Colors.surfaceSoft, paddingHorizontal: Spacing.four, paddingVertical: 13 },
  lockedText: { color: Colors.muted, fontSize: 15, fontWeight: '700' },
  notes: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  status: { color: Colors.muted, fontSize: 14, fontWeight: '700' },
});
