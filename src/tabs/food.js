import { escapeAttribute, escapeHtml, icon } from '../shared.js';
import {
  childAgeLabel,
  childDisplayName,
  childPossessiveName,
  getChildProfile,
} from '../../lib/profile-defaults.js';
import { buildFamilyLogistics } from '../../lib/kid-logistics.js';
import { removePlannedEvent, removeRecurringItem, savePlannedEvent, saveRecurringItem } from '../family-plans.js';

export const defaultToddlerFoods = ['peas', 'broccoli', 'banana', 'strawberry', 'sweet corn', 'sweet potato', 'dumplings', 'baby waffle', 'baby smoothie', 'yogurt bites'];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHOPPING_WEEKDAYS = [...WEEKDAYS];
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
      planId: cleanText(item?.planId, 80),
      eventPlanId: cleanText(item?.eventPlanId, 80),
      weekday,
      time,
      durationMinutes: cleanNumber(item?.durationMinutes, DEFAULT_DURATION_MINUTES, 15, 180),
      title: cleanText(item?.title, 80) || (index === 0 ? 'Fresh produce + snacks' : 'Freezer + pantry restock'),
      saved: item?.saved === true,
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
  const itemCount = Array.isArray(shoppingList) ? shoppingList.length : 0;
  return itemCount > 0
    ? `${event.title}. Current menu checklist: ${itemCount} item${itemCount === 1 ? '' : 's'}.`
    : `${event.title}. Current menu checklist is empty.`;
}

function resolveWeeklyMenu(childPlan, childProfile, favorites, seed) {
  const savedMenu = normalizeWeeklyMenu(childPlan.weeklyMenu);
  if (savedMenu.length > 0 && !isLegacyStaticWeeklyMenu(childPlan.weeklyMenu)) return savedMenu;
  return generateWeeklyMenu({ childProfile, favorites, seed });
}

function normalizeStringList(value) {
  return Array.isArray(value) ? [...new Set(value.map((item) => cleanText(item, 80).toLowerCase()).filter(Boolean))] : [];
}

function menuShoppingItems(menu, customItems = []) {
  const knownFoods = [...new Set([
    ...Object.values(foodPools).flat(),
    ...defaultToddlerFoods,
  ])].sort((a, b) => b.length - a.length);
  const items = [];
  normalizeWeeklyMenu(menu).forEach((meal) => {
    [meal.breakfast, meal.lunch, meal.snack, meal.dinner].forEach((text) => {
      const lower = text.toLowerCase();
      knownFoods.forEach((food) => {
        if (lower.includes(food.toLowerCase())) addUnique(items, food);
      });
    });
  });
  normalizeStringList(customItems).forEach((item) => addUnique(items, item));
  return items.length > 0 ? items : normalizeFoodList([], []);
}

function checklistGroups(items) {
  const groups = { 'Produce': [], 'Protein + dairy': [], 'Pantry + freezer': [] };
  items.forEach((item) => {
    const category = categorizeFood(item);
    const group = category === 'fruits' || category === 'vegetables'
      ? 'Produce'
      : category === 'proteins' || category === 'dairy'
        ? 'Protein + dairy'
        : 'Pantry + freezer';
    groups[group].push(item);
  });
  return groups;
}

export function applyFoodProfile(state, user) {
  const childProfile = getChildProfile(user);
  const childPlan = activeFoodPlan(user);
  const favorites = normalizeFoodList(childPlan.favorites);
  const seed = cleanNumber(childPlan.menuSeed, 0, 0, 1000000);
  state.shoppingList = favorites;
  state.weeklyMenu = resolveWeeklyMenu(childPlan, childProfile, favorites, seed);
  // Grocery schedules are owned by family_recurring_items now. Start with
  // UI defaults until the normalized family-plan request finishes.
  state.shoppingSchedule = defaultShoppingSchedule();
  state.foodPlanSeed = seed;
  state.foodPlanGeneratedAt = cleanText(childPlan.lastGeneratedAt, 40);
  state.lockedMealDays = normalizeStringList(childPlan.lockedMealDays);
  state.checkedShoppingItems = normalizeStringList(childPlan.checkedShoppingItems);
  state.customShoppingItems = normalizeStringList(childPlan.customShoppingItems);
  state.foodStatus = '';
}

export function resetFoodState(state) {
  state.shoppingList = [...defaultToddlerFoods];
  state.weeklyMenu = [];
  state.shoppingSchedule = defaultShoppingSchedule();
  state.foodPlanSeed = 0;
  state.foodPlanGeneratedAt = '';
  state.lockedMealDays = [];
  state.checkedShoppingItems = [];
  state.customShoppingItems = [];
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
    lockedMealDays: normalizeStringList(overrides.lockedMealDays ?? state.lockedMealDays),
    checkedShoppingItems: normalizeStringList(overrides.checkedShoppingItems ?? state.checkedShoppingItems),
    customShoppingItems: normalizeStringList(overrides.customShoppingItems ?? state.customShoppingItems),
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
  const nextMenu = generateWeeklyMenu({ childProfile, favorites, seed });
  const locked = new Set(state.lockedMealDays || []);
  state.weeklyMenu = nextMenu.map((meal, index) => locked.has(meal.day) ? state.weeklyMenu[index] || meal : meal);
  state.foodPlanSeed = seed;
  state.foodPlanGeneratedAt = new Date().toISOString();
  state.foodStatus = 'New weekly menu generated. Save the food plan to keep it.';
  ctx.renderCurrent();
}

function regenerateMeal(ctx, index) {
  const { state } = ctx;
  const meal = state.weeklyMenu[index];
  if (!meal) return;
  if ((state.lockedMealDays || []).includes(meal.day)) {
    state.foodStatus = `${meal.day} is locked. Unlock it before regenerating.`;
    ctx.renderCurrent();
    return;
  }
  const childProfile = getChildProfile(state.user);
  const seed = cleanNumber(state.foodPlanSeed, 0, 0, 1000000) + 1;
  const replacement = generateWeeklyMenu({ childProfile, favorites: normalizeFoodList(state.shoppingList), seed })[index];
  state.weeklyMenu = state.weeklyMenu.map((item, itemIndex) => itemIndex === index ? replacement : item);
  state.foodPlanSeed = seed;
  state.foodPlanGeneratedAt = new Date().toISOString();
  state.foodStatus = `${meal.day} refreshed. Other days stayed in place.`;
  ctx.renderCurrent();
}

function toggleMealLock(ctx, day) {
  const locked = new Set(ctx.state.lockedMealDays || []);
  if (locked.has(day)) locked.delete(day); else locked.add(day);
  ctx.state.lockedMealDays = [...locked];
  ctx.state.foodStatus = locked.has(day) ? `${day} locked. Regenerate the week to reshuffle the other days.` : `${day} unlocked.`;
  ctx.renderCurrent();
}

function toggleShoppingItem(ctx, item) {
  const key = item.toLowerCase();
  const checked = new Set(ctx.state.checkedShoppingItems || []);
  if (checked.has(key)) checked.delete(key); else checked.add(key);
  ctx.state.checkedShoppingItems = [...checked];
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

  const exists = state.customShoppingItems.some((food) => food.toLowerCase() === value.toLowerCase());
  if (exists) {
    state.foodStatus = `${value} is already in the menu checklist.`;
    ctx.renderCurrent();
    return;
  }

  state.shoppingList = [...state.shoppingList, value];
  state.customShoppingItems = [...state.customShoppingItems, value];
  state.newFood = '';
  state.foodStatus = `${value} added to the menu checklist. Save when ready.`;
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
  const removed = schedule[index];
  if (removed?.planId) {
    removeRecurringItem(removed.planId).catch((error) => {
      state.foodStatus = `Could not remove grocery event: ${error.message}`;
      ctx.renderCurrent();
    });
    state.familyRecurringItems = (state.familyRecurringItems || []).filter((item) => item.id !== removed.planId);
  }
  if (removed?.eventPlanId) {
    removePlannedEvent(removed.eventPlanId).catch((error) => {
      state.foodStatus = `Could not remove grocery event occurrence: ${error.message}`;
      ctx.renderCurrent();
    });
    state.familyPlanEvents = (state.familyPlanEvents || []).filter((item) => item.id !== removed.eventPlanId);
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

async function saveShoppingEvent(ctx, index) {
  const schedule = normalizeShoppingSchedule(ctx.state.shoppingSchedule);
  if (!schedule[index]) return;
  const selected = schedule[index];
  ctx.state.shoppingSchedule = schedule.map((item, itemIndex) => itemIndex === index ? { ...item, saved: true } : item);
  try {
    const response = await saveRecurringItem({
      id: selected.planId,
      childId: getChildProfile(ctx.state.user)?.id || null,
      kind: 'grocery',
      title: selected.title,
      recurrenceRule: {
        weekday: selected.weekday,
        time: selected.time,
        durationMinutes: selected.durationMinutes,
      },
      metadata: { legacyId: selected.id },
      active: true,
    });
    const saved = response.item;
    const start = nextDateForWeekday(selected.weekday, selected.time);
    const end = new Date(start.getTime() + selected.durationMinutes * 60 * 1000);
    const eventResponse = await savePlannedEvent({
      id: selected.eventPlanId,
      childId: getChildProfile(ctx.state.user)?.id || null,
      kind: 'grocery',
      title: selected.title,
      summary: `Recurring grocery block on ${selected.weekday}.`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      status: 'planned',
      source: 'food',
      metadata: {
        recurringId: saved.id,
        weekday: selected.weekday,
        time: selected.time,
        durationMinutes: selected.durationMinutes,
        legacyId: selected.id,
      },
    });
    const savedEvent = eventResponse.item;
    ctx.state.shoppingSchedule = ctx.state.shoppingSchedule.map((item, itemIndex) => itemIndex === index ? { ...item, planId: saved.id, saved: true } : item);
    ctx.state.shoppingSchedule = ctx.state.shoppingSchedule.map((item, itemIndex) => itemIndex === index ? { ...item, eventPlanId: savedEvent.id } : item);
    ctx.state.familyRecurringItems = [
      ...(ctx.state.familyRecurringItems || []).filter((item) => item.id !== saved.id && item.metadata?.legacyId !== selected.id),
      saved,
    ];
    ctx.state.familyPlanEvents = [
      ...(ctx.state.familyPlanEvents || []).filter((item) => item.id !== savedEvent.id && item.metadata?.recurringId !== saved.id),
      savedEvent,
    ];
    ctx.state.foodStatus = `${selected.title} saved as a family event.`;
  } catch (error) {
    ctx.state.shoppingSchedule = schedule;
    ctx.state.foodStatus = `Could not save grocery event: ${error.message}`;
  }
  ctx.renderCurrent();
}

function weekdayOptions(selected) {
  return SHOPPING_WEEKDAYS
    .map((weekday) => `<option value="${weekday}" ${weekday === selected ? 'selected' : ''}>${weekday}</option>`)
    .join('');
}

function renderMealCard(meal, lockedDays = []) {
  const mealSlots = [['Breakfast', meal.breakfast], ['Lunch', meal.lunch], ['Snack', meal.snack], ['Dinner', meal.dinner]];
  const locked = lockedDays.includes(meal.day);
  return `<article class="panel meal-card"><div class="meal-card-header"><div><p class="eyebrow">${locked ? 'Locked block' : 'Menu block'}</p><h3>${escapeHtml(meal.day)}</h3></div><span class="lock-mark" aria-hidden="true">${locked ? '🔒' : '↻'}</span></div>${mealSlots.map(([label, value]) => `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`).join('')}<div class="meal-card-actions"><button class="secondary-button small-button" type="button" data-regenerate-meal="${escapeAttribute(meal.day)}">Regenerate</button><button class="secondary-button small-button" type="button" data-toggle-meal-lock="${escapeAttribute(meal.day)}">${locked ? 'Unlock' : 'Lock block'}</button></div><div class="meal-resources"><details><summary>Recipe idea</summary><p>${escapeHtml(recipeForMeal(meal))}</p></details><details><summary>Nutrition facts</summary><p>${escapeHtml(nutritionForMeal(meal))}</p></details></div></article>`;
}

function recipeForMeal(meal) {
  return `Prep the ${meal.dinner.toLowerCase()} components until soft, then serve in toddler-sized pieces. Offer water and adjust texture, seasoning, and portion to your child.`;
}

function nutritionForMeal(meal) {
  const text = `${meal.breakfast} ${meal.lunch} ${meal.snack} ${meal.dinner}`.toLowerCase();
  const nutrients = ['Fruit and vegetable variety'];
  if (/chicken|salmon|tofu|bean|turkey|hummus|fish/.test(text)) nutrients.push('protein source');
  if (/yogurt|cheese|milk/.test(text)) nutrients.push('calcium-rich food');
  if (/rice|pasta|waffle|oat|toast|pita|grain|noodle/.test(text)) nutrients.push('energy-giving grains');
  return `${nutrients.join(', ')}. Planning estimate only; portions and nutrition vary by brand, recipe, and serving size.`;
}

function renderShoppingEvent(schedule, index, checklistItems) {
  return `<article class="event-card shopping-event-card"><div class="shopping-event-heading"><div><span>${escapeHtml(formatShoppingWindow(schedule))}</span><h3>${escapeHtml(schedule.title)}</h3></div><button class="secondary-button small-button" type="button" data-edit-schedule="${index}">Edit timing</button></div><p>${escapeHtml(shoppingSummary(schedule, checklistItems))}</p><div class="schedule-editor" data-schedule-editor="${index}"><label><small>Shopping focus</small><input data-schedule-index="${index}" data-schedule-field="title" value="${escapeAttribute(schedule.title)}" maxlength="80" /></label><div class="schedule-controls"><label><small>Weekday</small><select data-schedule-index="${index}" data-schedule-field="weekday">${weekdayOptions(schedule.weekday)}</select></label><label><small>Start</small><input type="time" data-schedule-index="${index}" data-schedule-field="time" value="${escapeAttribute(schedule.time)}" /></label><label><small>Minutes</small><input type="number" min="15" max="180" step="15" data-schedule-index="${index}" data-schedule-field="durationMinutes" value="${escapeAttribute(schedule.durationMinutes)}" /></label></div><div class="event-actions"><button class="secondary-button small-button" type="button" data-save-shopping-event="${index}">${schedule.saved ? 'Saved event' : 'Save event'}</button><button class="secondary-button small-button danger-button" type="button" data-remove-shopping-block="${index}">Remove</button></div></div></article>`;
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
  const logistics = buildFamilyLogistics(state.user, { restockItems: state.restockItems, logisticsItems: state.logisticsItems });
  const logisticsFoodItems = logistics.foodItems.map((item) => item.text);
  const checklistItems = menuShoppingItems(weeklyMenu, [...state.customShoppingItems, ...logisticsFoodItems]);
  const checklist = checklistGroups(checklistItems);
  const checked = new Set((state.checkedShoppingItems || []).filter((item) => checklistItems.includes(item)).map((item) => item.toLowerCase()));
  state.checkedShoppingItems = [...checked];
  const generatedAt = state.foodPlanGeneratedAt
    ? new Date(state.foodPlanGeneratedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Draft not saved yet';

  ctx.layout(`<main class="stack"><section class="panel title-panel">${icon('👨‍🍳')}<div><p class="eyebrow">Weekly refresh${ageLabel ? ` • ${escapeHtml(ageLabel)}` : ''}</p><h2>Menu ideas for ${escapeHtml(childName)}</h2><p>Builds a weekly menu from ${escapeHtml(possessiveChildName)} saved foods, profile notes, and allergy fields.</p>${foodNotes ? `<p class="muted">Profile notes: ${escapeHtml(foodNotes)}</p>` : ''}<div class="family-context"><strong>Family logistics context</strong><span>${escapeHtml(logistics.kids.map((kid) => `${kid.name} • ${kid.ageLabel || 'age from profile'} • ${kid.stage}`).join(' | ') || 'Add child birthdays in Edit profile')}</span></div><div class="food-actions"><button id="regenerate-food-plan" class="secondary-button" type="button">Regenerate unlocked days</button><button id="save-food-plan" type="button">Save food plan</button></div><small>Last generated: ${escapeHtml(generatedAt)}</small></div></section><section class="menu-grid">${weeklyMenu.map((meal) => renderMealCard(meal, state.lockedMealDays || [])).join('')}</section><section class="grid two-cols"><div id="food-shopping-events" class="panel"><div class="section-heading"><div><h2>Grocery shopping events</h2><p class="muted">Save an event to keep it as a family object on Home. The full grocery list remains in the Food tab.</p></div><button id="add-shopping-block" class="secondary-button small-button" type="button">Add block</button></div>${shoppingSchedule.map((event, index) => renderShoppingEvent(event, index, checklistItems)).join('')}</div><div class="panel"><div class="section-heading"><div><h2>Food grocery checklist</h2><p class="muted">Menu ingredients and age-stage foods appear here. Care supplies and restock timing live in Errands.</p></div><span class="checklist-count">${checked.size}/${checklistItems.length}</span></div><div class="shopping-checklist">${Object.entries(checklist).map(([group, items]) => `<details open><summary>${escapeHtml(group)} <small>${items.length} items</small></summary><div class="shopping-list">${items.map((item) => `<label class="shopping-check-item"><input type="checkbox" data-check-shopping="${escapeAttribute(item)}" ${checked.has(item.toLowerCase()) ? 'checked' : ''} /><span>${escapeHtml(item)}</span></label>`).join('')}</div></details>`).join('')}</div><form id="shopping-form" class="shopping-edit"><label class="input-label" for="new-food">Food to keep in rotation</label><div class="inline-form"><input id="new-food" value="${escapeAttribute(state.newFood)}" placeholder="e.g. blueberries" /><button type="submit">Add</button></div></form><p class="muted">${escapeHtml(state.foodStatus || 'Lock a day you love, regenerate the rest, then save when ready.')}</p><div class="food-actions"><button id="save-shopping-list" class="secondary-button" type="button">Save food plan</button></div></div></section></main>`);

  if (state.foodFocus === 'shopping-events') {
    state.foodFocus = '';
    globalThis.requestAnimationFrame?.(() => document.getElementById('food-shopping-events')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  state.weeklyMenu = weeklyMenu;
  state.shoppingSchedule = shoppingSchedule;

  document.getElementById('regenerate-food-plan').addEventListener('click', () => regenerateFoodPlan(ctx));
  document.getElementById('save-food-plan').addEventListener('click', () => saveFoodPlan(ctx, `Food plan saved for ${childName}.`));
  document.getElementById('save-shopping-list').addEventListener('click', () => saveFoodPlan(ctx, 'Shopping list saved for this user.'));
  document.getElementById('add-shopping-block').addEventListener('click', () => addShoppingBlock(ctx));
  document.getElementById('shopping-form').addEventListener('submit', (event) => addShoppingItem(ctx, event));
  document.getElementById('new-food').addEventListener('input', (event) => { state.newFood = event.target.value; });
  document.querySelectorAll('[data-remove-food]').forEach((button) => button.addEventListener('click', () => removeShoppingItem(ctx, Number(button.dataset.removeFood))));
  document.querySelectorAll('[data-regenerate-meal]').forEach((button) => button.addEventListener('click', () => regenerateMeal(ctx, weeklyMenu.findIndex((meal) => meal.day === button.dataset.regenerateMeal))));
  document.querySelectorAll('[data-toggle-meal-lock]').forEach((button) => button.addEventListener('click', () => toggleMealLock(ctx, button.dataset.toggleMealLock)));
  document.querySelectorAll('[data-check-shopping]').forEach((input) => input.addEventListener('change', () => toggleShoppingItem(ctx, input.dataset.checkShopping)));
  document.querySelectorAll('[data-edit-schedule]').forEach((button) => button.addEventListener('click', () => {
    const editor = document.querySelector(`[data-schedule-editor="${button.dataset.editSchedule}"]`);
    const isOpen = editor.classList.toggle('is-open');
    button.textContent = isOpen ? 'Done editing' : 'Edit timing';
  }));
  document.querySelectorAll('[data-remove-shopping-block]').forEach((button) => button.addEventListener('click', () => removeShoppingBlock(ctx, Number(button.dataset.removeShoppingBlock))));
  document.querySelectorAll('[data-save-shopping-event]').forEach((button) => button.addEventListener('click', () => saveShoppingEvent(ctx, Number(button.dataset.saveShoppingEvent))));
  document.querySelectorAll('[data-schedule-field]').forEach((input) => {
    const field = input.dataset.scheduleField;
    const index = Number(input.dataset.scheduleIndex);
    const rerender = field !== 'title';
    input.addEventListener(rerender ? 'change' : 'input', (event) => updateShoppingSchedule(ctx, index, field, event.target.value, rerender));
  });
}
