import { createFamilyPlansClient } from '@sproutcue/shared/family-plans-client';
import { apiRequest } from './shared.js';

export const { loadFamilyPlans, saveFamilyPlan, removeFamilyPlan } = createFamilyPlansClient(apiRequest);

// Compatibility aliases for code outside the current app bundle.
export const savePlannedEvent = saveFamilyPlan;
export const removePlannedEvent = removeFamilyPlan;
