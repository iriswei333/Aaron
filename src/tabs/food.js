import { downloadCalendar, escapeAttribute, escapeHtml, icon } from '../shared.js';
import {
  childAgeLabel,
  childDisplayName,
  childPossessiveName,
  getChildProfile,
} from '../../lib/profile-defaults.js';

export const defaultToddlerFoods = ['peas', 'broccoli', 'banana', 'strawberry', 'sweet corn', 'sweet potato', 'dumplings', 'baby waffle', 'baby smoothie', 'yogurt bites'];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHOPPING_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DEFAULT_DURATION_MINUTES = 60;

const legacyStaticMenu = [
  ['Monday', 'Banana baby waffle + yogurt bites', 'Mini veggie dumplings + peas', 'Strawberry smoothie', 'Sweet potato mash + broccoli florets'],
  ['Tuesday', 'Yogurt bowl with banana coins', 'Sweet corn veggie fried rice', 'Baby smoothie pouch', 'Chicken dumpling soup with peas'],
  ['Wednesday', 'Mini waffle sticks + strawberries', 'Broccoli mac bites', 'Yogurt bites + banana', 'Sweet potato salmon cakes + corn'],
  ['Thursday', 'Smoothie cup + waffle', 'Pea and corn quesadilla triangles', 'Strawberries', 'Dumplings + soft broccoli'],
  ['Friday', 'Banana oatmeal + yogurt bites', 'Sweet potato veggie patties', 'Broccoli cheddar mini muffin', 'Family dumpling night with peas'],
  ['Weekend', 'Toddler brunch plate', 'Picnic bento with fruit', 'Smoothie after outing', 'Simple bowl: grain + veggie + protein'],
];

const foodPools = {
  fruits: ['banana', 'strawberry', 'blueberries', 'apple slices', 'pear slices', 'mango'],
  vegetables: ['peas', 'broccoli', 'sweet corn', 'sweet potato', 'carrots', 'cucumber sticks'],
  proteins: ['chicken', 'salmon', 'tofu', 'beans', 'turkey meatballs', 'hummus'],
  breakfastGrains: ['baby waffle', 'oatmeal', 'toast fingers', 'mini pancakes', 'banana muffin'],
  grains: ['rice', 'pasta', 'noodles', 'quesadilla triangles', 'grain bowl', 'soft pita'],
  dairy: ['yogurt', 'cheese', 'yogurt bites'],
  family: ['dumplings', 'grain bowl', 'soup', 'pasta bake', 'taco bowl', 'rice bowl'],
  snacks: ['smoothie', 'mini muffin', 'fruit cup', 'veggie pouch', 'cracker stack'],
};

const avoidAliases = {
  dairy: ['dairy', 'milk', 'cheese', 'yogurt', 'butter'],
  milk: ['milk', 'cheese', 'yogurt', 'butter'],
  egg: ['egg', 'eggs'],
  fish: ['fish', 'salmon', 'tuna', 'cod'],
  shellfish: ['shellfish', 'shrimp', 'crab'],
  peanut: ['peanut', 'peanuts', 'peanut butter'],
  peanuts: ['peanut', 'peanuts', 'peanut butter'],
  tree: ['tree nut', 'tree nuts', 'almond', 'cashew', 'walnut'],
  nut: ['nut', 'nuts', 'almond', 'cashew', 'walnut'],
  nuts: ['nut', 'nuts', 'almond', 'cashew', 'walnut'],
  soy: ['soy', 'tofu', 'edamame'],
  wheat: ['wheat', 'toast', 'pasta', 'waffle'],
  gluten: ['gluten', 'toast', 'pasta', 'waffle'],
};

const mealPatterns = [
  {
    breakfast: ({ fruit, breakfastGrain, dairy }) => `${capitalize(foodName(fruit))} ${foodName(breakfastGrain)} + ${foodName(dairy)}`,
    lunch: ({ vegetable, protein, grain }) => `${capitalize(foodName(protein))} ${foodName(grain)} with ${foodName(vegetable)}`,
    snack: ({ fruit, snack }) => `${capitalize(foodName(fruit))} + ${foodName(snack)}`,
    dinner: ({ family, vegetable }) => `${capitalize(foodName(family))} with soft ${foodName(vegetable)}`,
  },
  {
    breakfast: ({ breakfastGrain, fruit }) => `${capitalize(foodName(breakfastGrain))} with ${foodName(fruit)}`,
    lunch: ({ vegetable, grain, dairy }) => `${capitalize(foodName(vegetable))} ${foodName(grain)} + ${foodName(dairy)}`,
    snack: ({ dairy, fruit }) => `${capitalize(foodName(dairy))} and ${foodName(fruit)}`,
    dinner: ({ protein, vegetable, grain }) => `${capitalize(foodName(protein))}, ${foodName(vegetable)}, and ${foodName(grain)} bowl`,
  },
  {
    breakfast: ({ dairy, fruit }) => `${capitalize(foodName(dairy))} bowl with ${foodName(fruit)}`,
    lunch: ({ family, vegetable }) => `${capitalize(foodName(family))} lunch plate with ${foodName(vegetable)}`,
    snack: ({ snack, fruit }) => `${capitalize(foodName(snack))} after outing with ${foodName(fruit)}`,
    dinner: ({ protein, vegetable }) => `${capitalize(foodName(protein))} with roasted ${foodName(vegetable)}`,
  },
  {
    breakfast: ({ breakfastGrain, dairy }) => `${capitalize(foodName(breakfastGrain))} fingers + ${foodName(dairy)}`,
    lunch: ({ protein, vegetable }) => `${capitalize(foodName(protein))} bites with ${foodName(vegetable)}`,
    snack: ({ fruit }) => `${capitalize(foodName(fruit))} cup`,
    dinner: ({ family, protein, vegetable }) => `${capitalize(foodName(family))} with ${foodName(protein)} and ${foodName(vegetable)}`,
  },
];

function cleanText(value, maxLength = 120) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function cleanFoodText(value) {
  return cleanText(value, 50)
    .replace(/\bnoddles?\b/gi, 'noodles')
    .replace(/\bwater melon\b/gi, 'watermelon');
}

function cleanNumber(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizeFoodList(value, fallback = defaultToddlerFoods) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,;\n]/);
  const seen = new Set();
  const items = source
    .map(cleanFoodText)
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
  return items.length > 0 ? items : [...fallback];
}

function normalizeFoodPlanObject(plan = {}) {
  return plan && typeof plan === 'object' ? plan : {};
}

function activeFoodPlanKey(user) {
  return getChildProfile(user).id || 'default';
}

function activeFoodPlan(user) {
  const plan = normalizeFoodPlanObject(user?.foodPlan);
  const childPlan = normalizeFoodPlanObject(plan.byChild?.[activeFoodPlanKey(user)]);
  return Object.keys(childPlan).length > 0 ? childPlan : plan;
}

function normalizeMenuItem(item, fallbackDay = '') {
  if (Array.isArray(item)) {
    const [day, breakfast, lunch, snack, dinner] = item;
    return {
      day: cleanText(day || fallbackDay, 20),
      breakfast: cleanText(breakfast, 140),
      lunch: cleanText(lunch, 140),
      snack: cleanText(snack, 140),
      dinner: cleanText(dinner, 140),
    };
  }
  if (item && typeof item === 'object') {
    return {
      day: cleanText(item.day || fallbackDay, 20),
      breakfast: cleanText(item.breakfast, 140),
      lunch: cleanText(item.lunch, 140),
      snack: cleanText(item.snack, 140),
      dinner: cleanText(item.dinner, 140),
    };
  }
  return { day: fallbackDay, breakfast: '', lunch: '', snack: '', dinner: '' };
}

function normalizeWeeklyMenu(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => normalizeMenuItem(item, DAYS[index] || 'Day'))
    .filter((item) => item.day && item.breakfast && item.lunch && item.snack && item.dinner)
    .slice(0, 7);
}

function menuSignature(menu) {
  return JSON.stringify(normalizeWeeklyMenu(menu));
}

function isLegacyStaticWeeklyMenu(menu) {
  return menuSignature(menu) === menuSignature(legacyStaticMenu);
}

function allergyTerms(allergies = '') {
  const noneWords = new Set(['none', 'no', 'n/a', 'na', '']);
  return String(allergies || '')
    .toLowerCase()
    .split(/[,;\n]|\band\b|\bor\b/)
    .map((term) => cleanText(term, 40).replace(/^avoid\s+/, ''))
    .filter((term) => !noneWords.has(term));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function foodContainsAvoided(value, terms) {
  const text = String(value || '').toLowerCase();
  return terms.some((term) => {
    const aliases = avoidAliases[term] || [term];
    return aliases.some((alias) => {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}s?([^a-z0-9]|$)`, 'i');
      return pattern.test(text);
    });
  });
}

function categorizeFood(food) {
  const value = food.toLowerCase();
  if (/banana|straw|blueberr|apple|pear|mango|peach|fruit/.test(value)) return 'fruits';
  if (/pea|broccoli|corn|potato|carrot|cucumber|spinach|veg/.test(value)) return 'vegetables';
  if (/chicken|salmon|tofu|bean|turkey|hummus|egg|fish|meat/.test(value)) return 'proteins';
  if (/waffle|oat|toast|pancake|muffin|cereal/.test(value)) return 'breakfastGrains';
  if (/rice|pasta|quesadilla|bread|noodle|grain|pita/.test(value)) return 'grains';
  if (/yogurt|cheese|milk/.test(value)) return 'dairy';
  if (/smoothie|muffin|pouch|snack|cracker/.test(value)) return 'snacks';
  return 'family';
}

function addUnique(list, value) {
  const normalized = cleanText(value, 50);
  if (!normalized) return;
  if (!list.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
    list.push(normalized);
  }
}

function safePool(category, terms) {
  return foodPools[category].filter((food) => !foodContainsAvoided(food, terms));
}

function foodPreferencesList(childProfile) {
  return normalizeFoodList(String(childProfile?.foodPreferences || '').split(/[,;\n]|\band\b|\bor\b/), []);
}

function buildFoodPools(favorites, childProfile) {
  const terms = allergyTerms(childProfile?.allergies);
  const pools = Object.fromEntries(Object.keys(foodPools).map((category) => [category, []]));
  const candidates = [...normalizeFoodList(favorites, []), ...foodPreferencesList(childProfile)];

  candidates
    .filter((food) => !foodContainsAvoided(food, terms))
    .forEach((food) => addUnique(pools[categorizeFood(food)], food));

  Object.keys(pools).forEach((category) => {
    safePool(category, terms).forEach((food) => addUnique(pools[category], food));
  });

  if (pools.dairy.length === 0) pools.dairy = ['fruit cup'];
  if (pools.snacks.length === 0) pools.snacks = ['fruit cup'];
  if (pools.proteins.length === 0) pools.proteins = ['beans'];
  return pools;
}

function pick(list, index) {
  const source = list.length > 0 ? list : ['simple favorite'];
  return source[((index % source.length) + source.length) % source.length];
}

function foodName(value) {
  return cleanText(value, 50).toLowerCase();
}

function capitalize(value) {
  const text = cleanText(value, 140);
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

function createMealChoices(pools, seed, dayIndex) {
  const offset = seed + dayIndex * 3;
  return {
    fruit: pick(pools.fruits, offset),
    vegetable: pick(pools.vegetables, offset + 1),
    protein: pick(pools.proteins, offset + 2),
    breakfastGrain: pick(pools.breakfastGrains, offset + 3),
    grain: pick(pools.grains, offset + 4),
    dairy: pick(pools.dairy, offset + 5),
    family: pick(pools.family, offset + 6),
    snack: pick(pools.snacks, offset + 7),
  };
}

function generateWeeklyMenu({ childProfile, favorites, seed = 0 } = {}) {
  const pools = buildFoodPools(favorites, childProfile);
  return DAYS.map((day, index) => {
    const pattern = mealPatterns[(seed + index) % mealPatterns.length];
    const choices = createMealChoices(pools, seed, index);
    return {
      day,
      breakfast: pattern.breakfast(choices),
      lunch: pattern.lunch(choices),
      snack: pattern.snack(choices),
      dinner: pattern.dinner(choices),
    };
  });
}

function defaultShoppingSchedule(now = new Date()) {
  const upcoming = [];
  for (let offset = 0; upcoming.length < 3 && offset < 10; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const weekday = WEEKDAYS[date.getDay()];
    if (SHOPPING_WEEKDAYS.includes(weekday) && !(offset === 0 && now.getHours() >= 12)) {
      upcoming.push(weekday);
    }
  }

  return [
    {
      id: 'fresh',
      weekday: upcoming[0] || 'Monday',
      time: '10:00',
      durationMinutes: 60,
      title: 'Fresh produce + snacks',
    },
    {
      id: 'restock',
      weekday: upcoming[2] || upcoming[1] || 'Friday',
      time: '10:30',
      durationMinutes: 45,
      title: 'Freezer + pantry restock',
    },
  ];
}

function normalizeShoppingSchedule(value) {
  const source = Array.isArray(value) && value.length > 0 ? value : defaultShoppingSchedule();
  return source.map((item, index) => {
    const weekday = SHOPPING_WEEKDAYS.includes(item?.weekday) ? item.weekday : defaultShoppingSchedule()[index % 2].weekday;
    const time = /^\d{2}:\d{2}$/.test(item?.time || '') ? item.time : index === 0 ? '10:00' : '10:30';
    return {
      id: cleanText(item?.id, 40) || `shopping-${index + 1}`,
      weekday,
      time,
      durationMinutes: cleanNumber(item?.durationMinutes, DEFAULT_DURATION_MINUTES, 15, 180),
      title: cleanText(item?.title, 80) || (index === 0 ? 'Fresh produce + snacks' : 'Freezer + pantry restock'),
    };
  }).slice(0, 4);
}

function nextDateForWeekday(weekday, time, now = new Date()) {
  const targetDay = WEEKDAYS.indexOf(weekday);
  const [hour, minute] = time.split(':').map((part) => Number.parseInt(part, 10));
  const date = new Date(now);
  let dayOffset = (targetDay - now.getDay() + 7) % 7;
  if (dayOffset === 0 && (now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute))) {
    dayOffset = 7;
  }
  date.setDate(now.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function calendarDateTime(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
    'T',
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes()),
    '00',
  ].join('');
}

function formatTimeLabel(time) {
  const [hour, minute] = time.split(':').map((part) => Number.parseInt(part, 10));
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatShoppingWindow(event) {
  const start = nextDateForWeekday(event.weekday, event.time);
  const dateLabel = start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  return `${dateLabel} at ${formatTimeLabel(event.time)}`;
}

function shoppingSummary(event, shoppingList) {
  const foods = shoppingList.slice(0, 6).join(', ');
  return foods
    ? `${event.title}. Bring home: ${foods}${shoppingList.length > 6 ? ', and more' : ''}.`
    : event.title;
}

function resolveWeeklyMenu(childPlan, childProfile, favorites, seed) {
  const savedMenu = normalizeWeeklyMenu(childPlan.weeklyMenu);
  if (savedMenu.length > 0 && !isLegacyStaticWeeklyMenu(childPlan.weeklyMenu)) return savedMenu;
  return generateWeeklyMenu({ childProfile, favorites, seed });
}

export function applyFoodProfile(state, user) {
  const childProfile = getChildProfile(user);
  const childPlan = activeFoodPlan(user);
  const favorites = normalizeFoodList(childPlan.favorites);
  const seed = cleanNumber(childPlan.menuSeed, 0, 0, 1000000);
  state.shoppingList = favorites;
  state.weeklyMenu = resolveWeeklyMenu(childPlan, childProfile, favorites, seed);
  state.shoppingSchedule = normalizeShoppingSchedule(childPlan.shoppingSchedule);
  state.foodPlanSeed = seed;
  state.foodPlanGeneratedAt = cleanText(childPlan.lastGeneratedAt, 40);
  state.foodStatus = '';
}

export function resetFoodState(state) {
  state.shoppingList = [...defaultToddlerFoods];
  state.weeklyMenu = [];
  state.shoppingSchedule = defaultShoppingSchedule();
  state.foodPlanSeed = 0;
  state.foodPlanGeneratedAt = '';
  state.newFood = '';
  state.foodStatus = '';
}

function currentChildPlan(ctx, overrides = {}) {
  const { state } = ctx;
  const childPlan = activeFoodPlan(state.user);
  const favorites = normalizeFoodList(overrides.favorites ?? state.shoppingList);
  const seed = cleanNumber(overrides.menuSeed ?? state.foodPlanSeed ?? childPlan.menuSeed, 0, 0, 1000000);
  return {
    ...childPlan,
    favorites,
    weeklyMenu: normalizeWeeklyMenu(overrides.weeklyMenu ?? state.weeklyMenu),
    shoppingSchedule: normalizeShoppingSchedule(overrides.shoppingSchedule ?? state.shoppingSchedule),
    menuSeed: seed,
    lastGeneratedAt: cleanText(overrides.lastGeneratedAt ?? childPlan.lastGeneratedAt, 40) || new Date().toISOString(),
  };
}

function foodPlanPayload(ctx, childPlan) {
  const currentPlan = normalizeFoodPlanObject(ctx.state.user?.foodPlan);
  const childKey = activeFoodPlanKey(ctx.state.user);
  const byChild = currentPlan.byChild && typeof currentPlan.byChild === 'object'
    ? { ...currentPlan.byChild }
    : {};
  byChild[childKey] = childPlan;

  return {
    ...currentPlan,
    ...childPlan,
    byChild,
  };
}

function saveFoodPlan(ctx, statusMessage) {
  const childPlan = currentChildPlan(ctx);
  return ctx.saveUserSection('food-plan', foodPlanPayload(ctx, childPlan), { successMessage: statusMessage });
}

function regenerateFoodPlan(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const seed = cleanNumber(state.foodPlanSeed, 0, 0, 1000000) + 1;
  const favorites = normalizeFoodList(state.shoppingList);
  state.weeklyMenu = generateWeeklyMenu({ childProfile, favorites, seed });
  state.foodPlanSeed = seed;
  state.foodPlanGeneratedAt = new Date().toISOString();
  state.foodStatus = 'New weekly menu generated. Save the food plan to keep it.';
  ctx.renderCurrent();
}

function addShoppingItem(ctx, event) {
  const { state } = ctx;
  event.preventDefault();
  const value = state.newFood.trim();
  if (!value) {
    state.foodStatus = 'Enter a food to add.';
    ctx.renderCurrent();
    return;
  }

  const exists = state.shoppingList.some((food) => food.toLowerCase() === value.toLowerCase());
  if (exists) {
    state.foodStatus = `${value} is already on the list.`;
    ctx.renderCurrent();
    return;
  }

  state.shoppingList = [...state.shoppingList, value];
  state.newFood = '';
  state.foodStatus = `${value} added. Regenerate the week or save when ready.`;
  ctx.renderCurrent();
}

function removeShoppingItem(ctx, index) {
  const { state } = ctx;
  const removed = state.shoppingList[index];
  state.shoppingList = state.shoppingList.filter((_, itemIndex) => itemIndex !== index);
  state.foodStatus = `${removed} removed. Regenerate the week or save when ready.`;
  ctx.renderCurrent();
}

function addShoppingBlock(ctx) {
  const { state } = ctx;
  const schedule = normalizeShoppingSchedule(state.shoppingSchedule);
  if (schedule.length >= 4) {
    state.foodStatus = 'Keep shopping to four weekday blocks or fewer.';
    ctx.renderCurrent();
    return;
  }
  const defaults = defaultShoppingSchedule();
  state.shoppingSchedule = [
    ...schedule,
    {
      ...defaults[schedule.length % defaults.length],
      id: `shopping-${Date.now().toString(36)}`,
      title: 'Grocery restock',
    },
  ];
  state.foodStatus = 'Shopping block added. Save the food plan to keep it.';
  ctx.renderCurrent();
}

function removeShoppingBlock(ctx, index) {
  const { state } = ctx;
  const schedule = normalizeShoppingSchedule(state.shoppingSchedule);
  if (schedule.length <= 1) {
    state.foodStatus = 'Keep at least one shopping block.';
    ctx.renderCurrent();
    return;
  }
  state.shoppingSchedule = schedule.filter((_, itemIndex) => itemIndex !== index);
  state.foodStatus = 'Shopping block removed. Save the food plan to keep it.';
  ctx.renderCurrent();
}

function updateShoppingSchedule(ctx, index, field, value, shouldRender = false) {
  const { state } = ctx;
  const schedule = normalizeShoppingSchedule(state.shoppingSchedule);
  const current = schedule[index];
  if (!current) return;
  const nextValue = field === 'durationMinutes'
    ? cleanNumber(value, current.durationMinutes, 15, 180)
    : cleanText(value, field === 'title' ? 80 : 20);
  state.shoppingSchedule = schedule.map((item, itemIndex) => (
    itemIndex === index ? { ...item, [field]: nextValue } : item
  ));
  state.foodStatus = 'Shopping schedule changed. Save the food plan to keep it.';
  if (shouldRender) ctx.renderCurrent();
}

function downloadShoppingEvent(schedule, shoppingList) {
  const start = nextDateForWeekday(schedule.weekday, schedule.time);
  const end = addMinutes(start, schedule.durationMinutes);
  downloadCalendar(
    schedule.title || 'Grocery shopping',
    calendarDateTime(start),
    calendarDateTime(end),
    shoppingSummary(schedule, shoppingList),
  );
}

function weekdayOptions(selected) {
  return SHOPPING_WEEKDAYS
    .map((weekday) => `<option value="${weekday}" ${weekday === selected ? 'selected' : ''}>${weekday}</option>`)
    .join('');
}

function renderMealCard(meal) {
  return `<article class="panel meal-card"><h3>${escapeHtml(meal.day)}</h3><p><strong>Breakfast:</strong> ${escapeHtml(meal.breakfast)}</p><p><strong>Lunch:</strong> ${escapeHtml(meal.lunch)}</p><p><strong>Snack:</strong> ${escapeHtml(meal.snack)}</p><p><strong>Dinner:</strong> ${escapeHtml(meal.dinner)}</p></article>`;
}

function renderShoppingEvent(schedule, index, shoppingList) {
  return `<article class="event-card shopping-event-card"><span>${escapeHtml(formatShoppingWindow(schedule))}</span><label><small>Shopping focus</small><input data-schedule-index="${index}" data-schedule-field="title" value="${escapeAttribute(schedule.title)}" maxlength="80" /></label><div class="schedule-controls"><label><small>Weekday</small><select data-schedule-index="${index}" data-schedule-field="weekday">${weekdayOptions(schedule.weekday)}</select></label><label><small>Start</small><input type="time" data-schedule-index="${index}" data-schedule-field="time" value="${escapeAttribute(schedule.time)}" /></label><label><small>Minutes</small><input type="number" min="15" max="180" step="15" data-schedule-index="${index}" data-schedule-field="durationMinutes" value="${escapeAttribute(schedule.durationMinutes)}" /></label></div><p>${escapeHtml(shoppingSummary(schedule, shoppingList))}</p><div class="event-actions"><button class="secondary-button small-button" type="button" data-download-shopping-event="${index}">Download event</button><button class="secondary-button small-button danger-button" type="button" data-remove-shopping-block="${index}">Remove</button></div></article>`;
}

export function renderFood(ctx) {
  const { state } = ctx;
  const childProfile = getChildProfile(state.user);
  const childName = childDisplayName(childProfile);
  const possessiveChildName = childPossessiveName(childProfile);
  const ageLabel = childAgeLabel(childProfile);
  const foodNotes = [childProfile.foodPreferences, childProfile.allergies ? `Avoid: ${childProfile.allergies}` : '']
    .filter(Boolean)
    .join(' • ');
  const shoppingList = normalizeFoodList(state.shoppingList);
  const weeklyMenu = normalizeWeeklyMenu(state.weeklyMenu).length > 0
    ? normalizeWeeklyMenu(state.weeklyMenu)
    : generateWeeklyMenu({ childProfile, favorites: shoppingList, seed: state.foodPlanSeed || 0 });
  const shoppingSchedule = normalizeShoppingSchedule(state.shoppingSchedule);
  const generatedAt = state.foodPlanGeneratedAt
    ? new Date(state.foodPlanGeneratedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Draft not saved yet';

  ctx.layout(`<main class="stack"><section class="panel title-panel">${icon('👨‍🍳')}<div><p class="eyebrow">Weekly refresh${ageLabel ? ` • ${escapeHtml(ageLabel)}` : ''}</p><h2>Menu ideas for ${escapeHtml(childName)}</h2><p>Builds a weekly menu from ${escapeHtml(possessiveChildName)} saved foods, profile notes, and allergy fields.</p>${foodNotes ? `<p class="muted">Profile notes: ${escapeHtml(foodNotes)}</p>` : ''}<div class="food-actions"><button id="regenerate-food-plan" class="secondary-button" type="button">Regenerate week</button><button id="save-food-plan" type="button">Save food plan</button></div><small>Last generated: ${escapeHtml(generatedAt)}</small></div></section><section class="menu-grid">${weeklyMenu.map(renderMealCard).join('')}</section><section class="grid two-cols"><div class="panel"><div class="section-heading"><div><h2>Grocery weekday shopping events</h2><p class="muted">Choose the weekday blocks that fit your week, then download calendar events for the next matching date.</p></div><button id="add-shopping-block" class="secondary-button small-button" type="button">Add block</button></div>${shoppingSchedule.map((event, index) => renderShoppingEvent(event, index, shoppingList)).join('')}</div><div class="panel"><h2>Shopping list</h2><div class="shopping-list">${shoppingList.map((food, index) => `<div class="shopping-item"><label><input type="checkbox" /> ${escapeHtml(food)}</label><button class="icon-button danger" type="button" data-remove-food="${index}" aria-label="Remove ${escapeAttribute(food)}">×</button></div>`).join('')}</div><form id="shopping-form" class="shopping-edit"><label class="input-label" for="new-food">Add food</label><div class="inline-form"><input id="new-food" value="${escapeAttribute(state.newFood)}" placeholder="e.g. blueberries" /><button type="submit">Add</button></div></form><p class="muted">${escapeHtml(state.foodStatus || 'Edit foods and shopping blocks, regenerate the week, then save the food plan.')}</p><div class="food-actions"><button id="save-shopping-list" class="secondary-button" type="button">Save shopping list</button></div></div></section></main>`);

  state.weeklyMenu = weeklyMenu;
  state.shoppingSchedule = shoppingSchedule;

  document.getElementById('regenerate-food-plan').addEventListener('click', () => regenerateFoodPlan(ctx));
  document.getElementById('save-food-plan').addEventListener('click', () => saveFoodPlan(ctx, `Food plan saved for ${childName}.`));
  document.getElementById('save-shopping-list').addEventListener('click', () => saveFoodPlan(ctx, 'Shopping list saved for this user.'));
  document.getElementById('add-shopping-block').addEventListener('click', () => addShoppingBlock(ctx));
  document.getElementById('shopping-form').addEventListener('submit', (event) => addShoppingItem(ctx, event));
  document.getElementById('new-food').addEventListener('input', (event) => { state.newFood = event.target.value; });
  document.querySelectorAll('[data-remove-food]').forEach((button) => button.addEventListener('click', () => removeShoppingItem(ctx, Number(button.dataset.removeFood))));
  document.querySelectorAll('[data-remove-shopping-block]').forEach((button) => button.addEventListener('click', () => removeShoppingBlock(ctx, Number(button.dataset.removeShoppingBlock))));
  document.querySelectorAll('[data-download-shopping-event]').forEach((button) => button.addEventListener('click', () => {
    const schedule = normalizeShoppingSchedule(state.shoppingSchedule);
    downloadShoppingEvent(schedule[Number(button.dataset.downloadShoppingEvent)], shoppingList);
  }));
  document.querySelectorAll('[data-schedule-field]').forEach((input) => {
    const field = input.dataset.scheduleField;
    const index = Number(input.dataset.scheduleIndex);
    const rerender = field !== 'title';
    input.addEventListener(rerender ? 'change' : 'input', (event) => updateShoppingSchedule(ctx, index, field, event.target.value, rerender));
  });
}
