const DAY_MS = 24 * 60 * 60 * 1000;

// Versioned, deterministic defaults. Keep this table boring and reviewable.
export const LOGISTICS_STAGES = [
  {
    id: 'infant-milk',
    months: [0, 6],
    stage: 'formula/milk only',
    diaper: true,
    defaultDiaperSize: 1,
    foodItems: ['formula'],
    supplyItems: [
      'bottles and nipples',
      'bottle brush',
      'burp cloths',
      'baby wash',
      'diaper cream',
      'wipes',
    ],
    diaperUnitsPerDay: 10,
  },
  {
    id: 'baby-solids',
    months: [6, 12],
    stage: 'purees + BLW',
    diaper: true,
    defaultDiaperSize: 3,
    foodItems: ['baby oatmeal', 'pouches', 'soft finger foods'],
    supplyItems: [
      'silicone bibs',
      'baby spoons and bowls',
      'training cup',
      'baby wash',
      'washcloths',
    ],
    diaperUnitsPerDay: 7,
  },
  {
    id: 'toddler-solids',
    months: [12, 24],
    stage: 'toddler solids',
    diaper: true,
    defaultDiaperSize: 4,
    foodItems: ['whole milk', 'soft finger foods'],
    supplyItems: [
      'baby soap',
      'baby shampoo',
      'rash cream',
      'toddler toothbrush',
      'fluoride toothpaste',
      'change bibs',
      'washcloths',
      'gentle laundry detergent',
      'disinfectant wipes',
      'pull-ups',
    ],
    diaperUnitsPerDay: 5.5,
  },
  {
    id: 'preschool',
    months: [24, 48],
    stage: 'family meals, cut small',
    diaper: 'training',
    defaultDiaperSize: 4,
    foodItems: ['snack packs'],
    supplyItems: [
      'pull-ups',
      'potty-training wipes',
      'disinfectant wipes',
      'potty seat or step stool',
      'hand soap',
      'spare clothes',
      'child-size water bottle',
    ],
    diaperUnitsPerDay: 3,
  },
  {
    id: 'family-meals',
    months: [48, 999],
    stage: 'family meals',
    diaper: false,
    foodItems: ['lunchbox items'],
    supplyItems: [
      'reusable water bottle',
      'snack containers',
      'napkins',
      'spare clothes for school or outings',
      'stain remover',
    ],
    diaperUnitsPerDay: 0,
  },
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
  return Number.isFinite(stage.defaultDiaperSize) ? stage.defaultDiaperSize : null;
}

export function deriveKidLogistics(child = {}, now = new Date()) {
  const months = ageInMonths(child, now);
  const stage = logisticsStageForAge(months ?? 48);
  const explicitStage = text(child.feedingStage || child.feeding_stage);
  const diaperSize = observedDiaperSize(child, stage);
  const foodItems = stage.foodItems
    .map((item) => item === 'whole milk' && /oat milk/i.test(child.foodPreferences || '') ? 'oat milk' : item);
  const supplyItems = [...stage.supplyItems];
  if (stage.diaper === true && diaperSize) supplyItems.push(`size ${diaperSize} diapers`);
  const items = [...foodItems, ...supplyItems];
  return {
    kidId: child.id || '',
    name: text(child.name, 'Child'),
    ageMonths: months,
    ageLabel: ageLabelFromMonths(months) || text(child.ageLabel),
    stage: explicitStage || stage.stage,
    derivedStage: stage.stage,
    diaperSize,
    diaperUnitsPerDay: Number(child.diaperUnitsPerDay) > 0 ? Number(child.diaperUnitsPerDay) : stage.diaperUnitsPerDay,
    foodItems: [...new Set(foodItems)],
    supplyItems: [...new Set(supplyItems)],
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

function cleanFrequencyDays(value) {
  const days = Number.parseInt(value, 10);
  return Number.isFinite(days) && days > 0 ? Math.min(days, 3650) : null;
}

function itemKey(textValue, kidId = '') {
  return `${kidId || 'family'}:${text(textValue).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function nextRestockDate(lastRestocked, frequencyDays, now = new Date()) {
  const frequency = cleanFrequencyDays(frequencyDays);
  const anchor = dateOnly(lastRestocked);
  if (!frequency || !anchor) return '';
  const next = new Date(anchor);
  next.setDate(next.getDate() + frequency);
  return next.toISOString().slice(0, 10);
}

function normalizeSavedLogisticsItems(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

export function buildFamilyLogistics(user, errands = {}, now = new Date()) {
  const children = Array.isArray(user?.childProfile?.children) ? user.childProfile.children : [];
  const settings = errands?.restockItems && typeof errands.restockItems === 'object' ? errands.restockItems : {};
  const savedItems = normalizeSavedLogisticsItems(errands?.logisticsItems);
  const kids = children.map((child) => deriveKidLogistics(child, now));
  const suggested = kids.flatMap((kid) => kid.supplyItems.map((item) => ({
    id: itemKey(item, kid.kidId),
    text: item,
    kidId: kid.kidId,
    kidName: kid.name,
    reason: 'age-stage',
  })));
  const savedById = new Map(savedItems.map((item) => [item.id, item]));
  const derivedItems = suggested
    .map((item) => ({ ...item, ...savedById.get(item.id) }))
    .filter((item) => item.active !== false);
  const suggestedIds = new Set(suggested.map((item) => item.id));
  const customItems = savedItems
    .filter((item) => !suggestedIds.has(item.id) && item.active !== false && text(item.text))
    .map((item) => ({
      ...item,
      id: item.id || itemKey(item.text, item.kidId),
      text: text(item.text),
      kidId: text(item.kidId),
      kidName: text(item.kidName, 'Family'),
      reason: 'custom',
    }));
  const items = [...derivedItems, ...customItems].map((item) => {
    const legacy = settings[item.kidId] || {};
    const lastRestocked = item.lastRestocked || legacy.lastPurchased || '';
    const frequencyDays = cleanFrequencyDays(item.frequencyDays);
    return {
      ...item,
      frequencyDays,
      lastRestocked,
      nextRestockDate: nextRestockDate(lastRestocked, frequencyDays, now),
    };
  });
  const restockDue = items.filter((item) => item.nextRestockDate && item.nextRestockDate <= new Date(now).toISOString().slice(0, 10));
  return { kids, foodItems: kids.flatMap((kid) => kid.foodItems.map((item) => ({ text: item, kidId: kid.kidId, kidName: kid.name, reason: 'age-stage' }))), restockDue, items };
}
