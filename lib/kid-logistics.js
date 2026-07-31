const DAY_MS = 24 * 60 * 60 * 1000;

// Versioned, deterministic defaults. Keep this table boring and reviewable.
export const LOGISTICS_STAGES = [
  { id: 'infant-milk', months: [0, 6], stage: 'formula/milk only', diaper: true, items: ['formula', 'size 1-2 diapers', 'wipes'], diaperUnitsPerDay: 10 },
  { id: 'baby-solids', months: [6, 12], stage: 'purees + BLW', diaper: true, items: ['baby oatmeal', 'pouches', 'size 3 diapers'], diaperUnitsPerDay: 7 },
  { id: 'toddler-solids', months: [12, 24], stage: 'toddler solids', diaper: true, items: ['whole milk', 'soft finger foods', 'size 4-5 diapers'], diaperUnitsPerDay: 5.5 },
  { id: 'preschool', months: [24, 48], stage: 'family meals, cut small', diaper: 'training', items: ['pull-ups', 'snack packs'], diaperUnitsPerDay: 3 },
  { id: 'family-meals', months: [48, 999], stage: 'family meals', diaper: false, items: ['lunchbox items'], diaperUnitsPerDay: 0 },
];

function text(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function dateOnly(value) {
  const valueText = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) return null;
  const date = new Date(`${valueText}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function ageInMonths(child = {}, now = new Date()) {
  const birthday = dateOnly(child.birthday || child.birthdate);
  if (!birthday || birthday > now) return null;
  let months = (now.getFullYear() - birthday.getFullYear()) * 12 + now.getMonth() - birthday.getMonth();
  if (now.getDate() < birthday.getDate()) months -= 1;
  return Math.max(months, 0);
}

export function ageLabelFromMonths(months) {
  if (!Number.isFinite(months)) return '';
  if (months < 12) return `${months}m`;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

export function logisticsStageForAge(months) {
  return LOGISTICS_STAGES.find((stage) => months !== null && months >= stage.months[0] && months < stage.months[1])
    || LOGISTICS_STAGES[LOGISTICS_STAGES.length - 1];
}

function observedDiaperSize(child, stage) {
  const size = Number.parseInt(child.diaperSize ?? child.diaper_size, 10);
  if (Number.isFinite(size) && size >= 1 && size <= 8) return size;
  const range = stage.items.find((item) => /diapers/.test(item));
  return range ? Number.parseInt(range.match(/\d+/)?.[0], 10) || null : null;
}

export function deriveKidLogistics(child = {}, now = new Date()) {
  const months = ageInMonths(child, now);
  const stage = logisticsStageForAge(months ?? 48);
  const explicitStage = text(child.feedingStage || child.feeding_stage);
  const diaperSize = observedDiaperSize(child, stage);
  const items = stage.items
    .filter((item) => !/diapers/.test(item))
    .map((item) => item === 'whole milk' && /oat milk/i.test(child.foodPreferences || '') ? 'oat milk' : item);
  if (stage.diaper === true && diaperSize) items.push(`size ${diaperSize} diapers`);
  return {
    kidId: child.id || '',
    name: text(child.name, 'Child'),
    ageMonths: months,
    ageLabel: ageLabelFromMonths(months) || text(child.ageLabel),
    stage: explicitStage || stage.stage,
    derivedStage: stage.stage,
    diaperSize,
    diaperUnitsPerDay: Number(child.diaperUnitsPerDay) > 0 ? Number(child.diaperUnitsPerDay) : stage.diaperUnitsPerDay,
    items: [...new Set(items)],
    preferences: text(child.foodPreferences),
    avoid: text(child.allergies),
    daycareDays: Array.isArray(child.daycareDays || child.daycare_days) ? (child.daycareDays || child.daycare_days) : [],
  };
}

export function estimateDaysLeft({ packageSize = 0, unitsPerDay = 0, lastPurchased, now = new Date() } = {}) {
  const purchased = dateOnly(lastPurchased);
  if (!purchased || packageSize <= 0 || unitsPerDay <= 0) return null;
  const daysSincePurchase = Math.max(0, Math.floor((new Date(now).setHours(0, 0, 0, 0) - purchased.getTime()) / DAY_MS));
  return Math.max(0, Math.ceil(Number(packageSize) / Number(unitsPerDay) - daysSincePurchase));
}

export function buildFamilyLogistics(user, errands = {}, now = new Date()) {
  const children = Array.isArray(user?.childProfile?.children) ? user.childProfile.children : [];
  const settings = errands?.restockItems && typeof errands.restockItems === 'object' ? errands.restockItems : {};
  const kids = children.map((child) => deriveKidLogistics(child, now));
  const restockDue = kids.flatMap((kid) => {
    const diaper = kid.items.find((item) => /diapers/.test(item));
    if (!diaper) return [];
    const saved = settings[kid.kidId] || {};
    const item = diaper.replace(/size \d+-\d+/, `size ${kid.diaperSize || 4}`);
    return [{
      id: `${kid.kidId}-diapers`, item, kidId: kid.kidId, kidName: kid.name,
      packageSize: Number(saved.packageSize) > 0 ? Number(saved.packageSize) : 92,
      unitsPerDay: Number(saved.unitsPerDay) > 0 ? Number(saved.unitsPerDay) : kid.diaperUnitsPerDay,
      lastPurchased: saved.lastPurchased || '',
      daysLeft: estimateDaysLeft({ packageSize: saved.packageSize || 92, unitsPerDay: saved.unitsPerDay || kid.diaperUnitsPerDay, lastPurchased: saved.lastPurchased, now }),
      confirmed: Boolean(saved.confirmedByUser),
    }];
  });
  const items = kids.flatMap((kid) => kid.items.filter((item) => !/diapers/.test(item)).map((item) => ({ text: item, kidId: kid.kidId, kidName: kid.name, reason: 'age-stage' })));
  return { kids, restockDue, items };
}

