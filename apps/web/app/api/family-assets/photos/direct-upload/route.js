import { photoCheckErrorResponse } from '../../../../../lib/child-photo-check.js';
import { createFamilyPhotoFromDirectUpload } from '../../../../../lib/family-photos.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../../lib/profile-session.js';
import { aiConsentErrorResponse, aiConsentResponse } from '../../../../../lib/ai-consent.js';

export const runtime = 'nodejs';
const AI_SOURCE_KINDS = new Set(['picture_book', 'practice_story', 'toy_play']);

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    if (current.mode !== 'supabase') {
      return Response.json({ error: 'Direct photo uploads require a signed-in account.' }, { status: 400 });
    }
    const body = await request.json() || {};
    const sourceKind = AI_SOURCE_KINDS.has(body.sourceKind) ? body.sourceKind : 'upload';
    // Photos for an AI creation go to OpenAI: ask for AI consent before saving anything.
    if (AI_SOURCE_KINDS.has(sourceKind)) { const blocked = aiConsentResponse(current); if (blocked) return blocked; }
    const photo = await createFamilyPhotoFromDirectUpload(current, body, {
      label: body.label || body.originalName,
      sourceKind,
      photoIndex: Number.isInteger(body.photoIndex) ? body.photoIndex : 0,
      language: body.language === 'zh-CN' ? 'zh-CN' : 'en',
    });
    return Response.json({ photo }, { status: 201 });
  } catch (error) {
    return aiConsentErrorResponse(error)
      ?? photoCheckErrorResponse(error)
      ?? Response.json({ error: error.message || 'The photo could not be saved.' }, { status: 400 });
  }
}
