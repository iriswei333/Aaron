import { processPendingAiJobs } from '../../../../lib/ai-jobs.js';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorized(request) {
  const secret = process.env.AI_JOB_WORKER_SECRET || process.env.CRON_SECRET || '';
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

async function run(request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  if (!supabase) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' }, { status: 503 });
  try {
    const jobs = await processPendingAiJobs(supabase, { limit: 1 });
    return Response.json({ processed: jobs.length, jobs });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}

export async function GET(request) { return run(request); }
export async function POST(request) { return run(request); }
