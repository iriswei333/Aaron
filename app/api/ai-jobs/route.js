import { after } from 'next/server';
import { getAiJob, processAiJob } from '../../../lib/ai-jobs.js';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const jobId = new URL(request.url).searchParams.get('jobId');
    if (!jobId) return Response.json({ error: 'jobId is required.' }, { status: 400 });
    const job = await getAiJob(current, jobId);
    if (job.status === 'queued') after(() => processAiJob(current, jobId));
    return Response.json({ job });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.code === 'NOT_FOUND' ? 404 : 500 });
  }
}
