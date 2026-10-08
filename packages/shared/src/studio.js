// Play Studio helpers shared by apps/web and apps/mobile: photo rules, AI job progress,
// picture-book pages, and where a finished creation opens. Plain JavaScript only.

export const MAX_AI_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_AI_TOTAL_PHOTO_BYTES = 90 * 1024 * 1024;
export const AI_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const PICTURE_BOOK_PHOTOS = { min: 2, max: 5 };
export const PRACTICE_STORY_MAX_PHOTOS = 5;

/** The four Play Studio cards (web featureCards). */
export const STUDIO_FEATURES = [
  { id: 'book', icon: '▤', title: 'A book starring them', copy: 'Turn favorite photos into a private, illustrated story.' },
  { id: 'toy', icon: '▧', title: 'New play, same toys', copy: 'Photograph a toy and discover a fresh way to play.' },
  { id: 'story', icon: '✦', title: 'Little stories, big steps', copy: 'Make a gentle story for a new routine or tricky moment.' },
  { id: 'voice', icon: '♫', title: 'Read in your voice', copy: 'Bring story time close with a familiar family voice.' },
];

/**
 * MIME type from a picked photo's declared type or file name (web photoMimeType).
 * @param {{ mimeType?: string | null, type?: string | null, fileName?: string | null, name?: string | null }} photo
 */
export function photoMimeType(photo = {}) {
  const declared = String(photo.mimeType || photo.type || '').toLowerCase();
  if (declared === 'image/jpg') return 'image/jpeg';
  if (declared.startsWith('image/')) return declared;
  const name = String(photo.fileName || photo.name || '').toLowerCase();
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  return declared;
}

/** File extension for the private upload path. @param {string} mimeType */
export function photoExtension(mimeType) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' })[mimeType] || 'image';
}

/** Supabase Storage path the API accepts for direct uploads: {userId}/incoming/{uploadId}.{ext}. */
export function incomingPhotoPath(userId, uploadId, mimeType) {
  if (!userId) throw new Error('Sign in again before uploading photos.');
  return `${userId}/incoming/${uploadId}.${photoExtension(mimeType)}`;
}

/**
 * Checks picked photos before uploading. Returns an error message or ''.
 * @param {{ mimeType?: string | null, fileName?: string | null, fileSize?: number | null }[]} photos
 * @param {{ min?: number, max?: number }} [limits]
 */
export function validateAiPhotos(photos = [], { min = 1, max = 5 } = {}) {
  const list = Array.isArray(photos) ? photos : [];
  if (list.length < min || list.length > max) {
    return min === max ? `Choose ${min} photo${min === 1 ? '' : 's'}.` : `Please choose ${min} to ${max} clear photos of your child.`;
  }
  if (list.some((photo) => !AI_IMAGE_TYPES.includes(photoMimeType(photo)))) return 'Choose JPEG, PNG, WebP, HEIC, or HEIF photos.';
  if (list.some((photo) => Number(photo.fileSize) > MAX_AI_PHOTO_BYTES)) return 'Each photo must be 20 MB or smaller.';
  const total = list.reduce((sum, photo) => sum + (Number(photo.fileSize) || 0), 0);
  if (total > MAX_AI_TOTAL_PHOTO_BYTES) return 'Your selected photos are over the 90 MB combined limit. Choose smaller photos or fewer photos.';
  return '';
}

/** "3 photos ready · 7.4 MB total". @param {{ fileSize?: number | null }[]} photos */
export function photoSelectionSummary(photos = []) {
  const bytes = photos.reduce((sum, photo) => sum + (Number(photo.fileSize) || 0), 0);
  const size = !bytes ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} ready${size ? ` · ${size} total` : ''}`;
}

// ── AI jobs (web ai-jobs.js) ─────────────────────────────────────────────────

/** @param {string | undefined | null} status */
export function aiJobIsDone(status) {
  return status === 'succeeded' || status === 'failed';
}

/** Seconds left from the job's estimate. @param {{ createdAt?: string, estimatedSeconds?: number } | null} job */
export function aiJobRemainingSeconds(job, now = Date.now()) {
  const started = new Date(job?.createdAt || now).getTime();
  const elapsed = Math.max(0, Math.floor((now - (Number.isNaN(started) ? now : started)) / 1000));
  return Math.max(0, (Number(job?.estimatedSeconds) || 60) - elapsed);
}

/** "1:05", "0:09", or "Finishing up…". @param {number} seconds */
export function aiJobTimeLabel(seconds) {
  if (seconds <= 0) return 'Finishing up…';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Progress bar width, 4–100. @param {{ progress?: number, status?: string } | null} job */
export function aiJobProgressPercent(job) {
  if (job?.status === 'succeeded') return 100;
  return Math.max(4, Math.min(100, Number(job?.progress) || 4));
}

/** "2 of 5 AI creations used today". @param {{ unlimited?: boolean, used?: number, limit?: number } | null} usage */
export function aiUsageLabel(usage) {
  if (!usage) return '';
  return usage.unlimited ? 'Admin account · unlimited AI creations' : `${usage.used} of ${usage.limit} AI creations used today`;
}

/**
 * Where a finished creation opens (job.result or a notification).
 * @param {{ assetType?: string, assetId?: string, pageKey?: string, href?: string } | null} result
 * @returns {{ kind: 'picture_book' | 'practice_story' | 'toy_play', id: string, pageKey?: string } | null}
 */
export function aiCreationDestination(result) {
  if (!result) return null;
  let { assetType, assetId, pageKey } = result;
  if ((!assetType || !assetId) && result.href) {
    const [path, query = ''] = String(result.href).split('?');
    const params = new URLSearchParams(query);
    if (params.get('toyPlay')) { assetType = 'toy_play'; assetId = params.get('toyPlay'); }
    else if (params.get('practiceStory')) { assetType = 'practice_story'; assetId = params.get('practiceStory'); }
    else if (path.includes('picture-books') && params.get('bookAssetId')) { assetType = 'picture_book'; assetId = params.get('bookAssetId'); pageKey = params.get('pageKey') || undefined; }
  }
  if (!assetId || !['picture_book', 'practice_story', 'toy_play'].includes(String(assetType))) return null;
  return { kind: /** @type {any} */ (assetType), id: String(assetId), ...(pageKey ? { pageKey } : {}) };
}

// ── Picture books (web bookCard) ─────────────────────────────────────────────

const PAGE_LABELS = {
  cover: 'Cover', doctor: 'Doctor', firefighter: 'Firefighter', 'police-officer': 'Police officer', astronaut: 'Astronaut',
  chef: 'Chef', teacher: 'Teacher', pilot: 'Pilot', scientist: 'Scientist', 'race-car-driver': 'Race car driver',
};

/** @param {string} key @param {{ titleEn?: string, titleZh?: string }} [page] */
export function pictureBookPageLabel(key, page = {}) {
  return page.titleEn || page.titleZh || PAGE_LABELS[key] || key;
}

/** @param {string | undefined} status */
export function pictureBookStatusLabel(status) {
  return ({ pending: 'Ready to create', generating: 'Making this page…', ready: 'Ready to view', failed: 'Try again', draft: 'Draft', archived: 'Archived' })[String(status)] || 'Ready to create';
}

/**
 * Pages in reading order with labels.
 * @param {{ pages?: Record<string, any> } | null} book
 * @returns {{ key: string, label: string, status: string, pageOrder: number, url: string | null, error: string | null }[]}
 */
export function pictureBookPages(book) {
  return Object.entries(book?.pages || {})
    .map(([key, page]) => ({ key, label: pictureBookPageLabel(key, page), status: page?.status || 'pending', pageOrder: Number(page?.pageOrder) || 0, url: page?.url || null, error: page?.error || null }))
    .sort((a, b) => a.pageOrder - b.pageOrder);
}

/** @param {{ pages?: Record<string, any> } | null} book */
export function pictureBookProgress(book) {
  const pages = pictureBookPages(book);
  const ready = pages.filter((page) => page.status === 'ready').length;
  return { ready, total: pages.length, complete: pages.length > 0 && ready === pages.length, generating: pages.some((page) => page.status === 'generating') };
}

/** Template icon (web uses 🎒 for kindergarten, 🌈 otherwise). @param {string | undefined} slug */
export function pictureBookTemplateIcon(slug) {
  return String(slug || '').includes('kindergarten') ? '🎒' : '🌈';
}

// ── Practice story request (web generatePracticeStory) ───────────────────────

/**
 * Body for POST /family-assets/practice-stories. Throws a friendly message when incomplete.
 * @param {{ goal?: string, challenge?: string, interests?: string, parentGoals?: string[], storyTheme?: string, adventureLength?: string, language?: string, savedPhotoIds?: string[] }} form
 */
export function practiceStoryRequest(form = {}) {
  const goal = String(form.goal || '').trim();
  const challenge = String(form.challenge || '');
  const interests = String(form.interests || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 5).join(', ');
  if ((!goal && !challenge) || !interests) throw new Error('Choose a current challenge and add at least one favorite thing.');
  return {
    goal,
    challenge,
    interests,
    parentGoals: [...(form.parentGoals || [])],
    storyTheme: form.storyTheme || '',
    adventureLength: form.adventureLength || '',
    language: form.language === 'zh-CN' ? 'zh-CN' : 'en',
    savedPhotoIds: [...new Set(form.savedPhotoIds || [])].slice(0, PRACTICE_STORY_MAX_PHOTOS),
  };
}

/** Adds or removes one comma-separated interest (web data-add-story-interest). */
export function toggleInterest(text, interest) {
  const items = String(text || '').split(',').map((item) => item.trim()).filter(Boolean);
  const has = items.some((item) => item.toLowerCase() === interest.toLowerCase());
  const next = has ? items.filter((item) => item.toLowerCase() !== interest.toLowerCase()) : [...items, interest].slice(0, 5);
  return next.join(', ');
}
