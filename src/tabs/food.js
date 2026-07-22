import { downloadCalendar, escapeAttribute, escapeHtml, icon } from '../shared.js';
import {
  childAgeLabel,
  childDisplayName,
  childPossessiveName,
  getChildProfile,
} from '../../lib/profile-defaults.js';

export const defaultToddlerFoods = ['peas', 'broccoli', 'banana', 'strawberry', 'sweet corn', 'sweet potato', 'dumplings', 'baby waffle', 'baby smoothie', 'yogurt bites'];

export const menu = [
  ['Monday', 'Banana baby waffle + yogurt bites', 'Mini veggie dumplings + peas', 'Strawberry smoothie', 'Sweet potato mash + broccoli florets'],
  ['Tuesday', 'Yogurt bowl with banana coins', 'Sweet corn veggie fried rice', 'Baby smoothie pouch', 'Chicken dumpling soup with peas'],
  ['Wednesday', 'Mini waffle sticks + strawberries', 'Broccoli mac bites', 'Yogurt bites + banana', 'Sweet potato salmon cakes + corn'],
  ['Thursday', 'Smoothie cup + waffle', 'Pea and corn quesadilla triangles', 'Strawberries', 'Dumplings + soft broccoli'],
  ['Friday', 'Banana oatmeal + yogurt bites', 'Sweet potato veggie patties', 'Broccoli cheddar mini muffin', 'Family dumpling night with peas'],
  ['Weekend', 'Toddler brunch plate', 'Picnic bento with fruit', 'Smoothie after outing', 'Simple bowl: grain + veggie + protein'],
];

export function applyFoodProfile(state, user) {
  state.shoppingList = Array.isArray(user.foodPlan?.favorites) && user.foodPlan.favorites.length > 0
    ? [...user.foodPlan.favorites]
    : [...defaultToddlerFoods];
  state.foodStatus = '';
}

export function resetFoodState(state) {
  state.shoppingList = [...defaultToddlerFoods];
  state.newFood = '';
  state.foodStatus = '';
}

function saveFoodPlan(ctx, favorites = ctx.state.shoppingList) {
  return ctx.saveUserSection('food-plan', { favorites, weeklyMenu: menu });
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
  state.foodStatus = `${value} added. Save when ready.`;
  ctx.renderCurrent();
}

function removeShoppingItem(ctx, index) {
  const { state } = ctx;
  const removed = state.shoppingList[index];
  state.shoppingList = state.shoppingList.filter((_, itemIndex) => itemIndex !== index);
  state.foodStatus = `${removed} removed. Save when ready.`;
  ctx.renderCurrent();
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
  const shoppingList = state.shoppingList.length > 0 ? state.shoppingList : [...defaultToddlerFoods];
  const shoppingText = shoppingList.join(' ');

  ctx.layout(`<main class="stack"><section class="panel title-panel">${icon('👨‍🍳')}<div><p class="eyebrow">Weekly refresh${ageLabel ? ` • ${escapeHtml(ageLabel)}` : ''}</p><h2>Menu ideas for ${escapeHtml(childName)}</h2><p>Rotates around ${escapeHtml(possessiveChildName)} saved favorites while balancing fruit, vegetables, protein, and simple family meals.</p>${foodNotes ? `<p class="muted">Profile notes: ${escapeHtml(foodNotes)}</p>` : ''}<button id="save-food-plan">Save food plan</button></div></section><section class="menu-grid">${menu.map(([day, b, l, s, d]) => `<article class="panel meal-card"><h3>${day}</h3><p><strong>Breakfast:</strong> ${b}</p><p><strong>Lunch:</strong> ${l}</p><p><strong>Snack:</strong> ${s}</p><p><strong>Dinner:</strong> ${d}</p></article>`).join('')}</section><section class="grid two-cols"><div class="panel"><h2>Grocery weekday shopping events</h2><article class="event-card"><span>Tuesday 10:00 AM</span><h3>Fresh produce + snacks</h3><p>Avoids the 3-6 PM weekday play block. Buy fruit, vegetables, yogurt bites, smoothie ingredients, and waffles.</p></article><article class="event-card"><span>Thursday 10:30 AM</span><h3>Freezer + pantry restock</h3><p>Avoids weekday play and leaves time before weekend playdate planning.</p></article></div><div class="panel"><h2>Shopping list</h2><div class="shopping-list">${shoppingList.map((food, index) => `<div class="shopping-item"><label><input type="checkbox" /> ${escapeHtml(food)}</label><button class="icon-button danger" data-remove-food="${index}" aria-label="Remove ${escapeAttribute(food)}">×</button></div>`).join('')}</div><form id="shopping-form" class="shopping-edit"><label class="input-label" for="new-food">Add food</label><div class="inline-form"><input id="new-food" value="${escapeAttribute(state.newFood)}" placeholder="e.g. blueberries" /><button type="submit">Add</button></div></form><p class="muted">${escapeHtml(state.foodStatus || 'Edit this list for the signed-in user, then save the food plan.')}</p><button id="save-shopping-list">Save shopping list</button><button id="download-shopping-event">🛒 Download shopping event</button></div></section></main>`);

  document.getElementById('save-food-plan').addEventListener('click', () => saveFoodPlan(ctx, shoppingList));
  document.getElementById('save-shopping-list').addEventListener('click', () => saveFoodPlan(ctx, shoppingList));
  document.getElementById('download-shopping-event').addEventListener('click', () => downloadCalendar('Whole Foods toddler shop', '20260519T100000', '20260519T110000', `Buy ${shoppingText}`));
  document.getElementById('shopping-form').addEventListener('submit', (event) => addShoppingItem(ctx, event));
  document.getElementById('new-food').addEventListener('input', (event) => { state.newFood = event.target.value; });
  document.querySelectorAll('[data-remove-food]').forEach((button) => button.addEventListener('click', () => removeShoppingItem(ctx, Number(button.dataset.removeFood))));
}
