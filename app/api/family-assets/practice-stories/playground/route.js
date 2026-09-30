import {
  generatePlaygroundPracticeStory,
  PLAYGROUND_PRACTICE_GOALS,
  savePlaygroundPracticeStory,
} from '../../../../../lib/family-practice-stories.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ goals: PLAYGROUND_PRACTICE_GOALS });
}

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json().catch(() => ({}));
    return Response.json({ story: await generatePlaygroundPracticeStory(current, body.goalId) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const body = await request.json().catch(() => ({}));
    return Response.json({ asset: await savePlaygroundPracticeStory(current, body.story) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
