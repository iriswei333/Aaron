import { after } from 'next/server';
import { enqueueAiJob, processAiJob } from '../../../../lib/ai-jobs.js';
import { getFamilyPictureBook } from '../../../../lib/family-picture-books.js';
import { getCurrentProfile, profileErrorResponse } from '../../../../lib/profile-session.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const { bookAssetId, pageKey, wholeBook } = await request.json();
    if (!bookAssetId || (!wholeBook && !pageKey)) return Response.json({ error: 'bookAssetId and pageKey, or wholeBook, are required.' }, { status: 400 });
    const book = await getFamilyPictureBook(current, String(bookAssetId));
    const pendingCount = book.pages.filter((page) => page.status !== 'ready').length;
    const queued = await enqueueAiJob(current, { jobType: wholeBook ? 'picture_book_whole' : 'picture_book_page', payload: { bookAssetId: String(bookAssetId), ...(wholeBook ? {} : { pageKey: String(pageKey) }) }, estimatedSeconds: wholeBook ? Math.max(45, pendingCount * 75) : 75 });
    after(() => processAiJob(current, queued.job.id));
    return Response.json(queued, { status: 202 });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code || null }, { status: error.code === 'NOT_FOUND' ? 404 : error.code === 'DAILY_AI_LIMIT_REACHED' ? 429 : 400 });
  }
}
