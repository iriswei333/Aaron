// Child-photo check for AI features that need a photo of the child (picture books, practice stories).
//
//   moderatePhoto()       — OpenAI safety screen (shared by toy play and practice stories)
//   classifyPhoto()       — one structured vision call: is there a real young child in the photo?
//   evaluateChildPhoto()  — pure rules that turn the classification into passed / rejected + code
//   checkChildPhoto()     — runs all three; CHILD_PHOTO_CHECK_MODE=off skips it (local dev only)
//
// Privacy: the model is told to classify only — never identify anyone or describe faces. Nothing
// about the face is stored; only the coarse result below (counts, age band, confidence).

import {
  isPhotoCheckCode,
  PHOTO_CHECK_CODES as CODES,
  photoCheckHelp,
  photoCheckMessage,
  photoCheckSeverity,
} from '@sproutcue/shared/photo-check';

const MODERATION_ENDPOINT = 'https://api.openai.com/v1/moderations';
const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_TIMEOUT_MS = 30_000;

export const CHILD_PHOTO_SOURCE_KINDS = new Set(['picture_book', 'practice_story']);
export const AGE_BANDS = ['none', 'infant', 'toddler', 'preschool', 'school_age', 'teen', 'adult'];
const PHOTO_ISSUES = ['blurry', 'too_dark', 'face_too_small', 'face_covered', 'heavy_filter'];

export const DEFAULT_CHILD_PHOTO_POLICY = Object.freeze({
  // Oldest apparent age band still accepted. Age estimates for kids are imprecise, so this is
  // deliberately lenient: only clear teens/adults are blocked, not 6–8 year olds.
  maxAgeBand: 'school_age',
  // true: a second child passes silently. false: it is flagged. The model sometimes counts a
  // doll, poster, reflection or background stranger as a second child, so by default it is only a
  // warning the parent may override; set blockMultipleChildren to make it a hard block again.
  allowMultipleChildren: false,
  blockMultipleChildren: false,
  // When the model itself reports low confidence, a block becomes a warning the parent may override.
  downgradeLowConfidence: true,
});

export const CHILD_PHOTO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isRealPhoto', 'personCount', 'childCount', 'primarySubjectIsChild', 'apparentAgeBand', 'faceClearlyVisible', 'issues', 'confidence'],
  properties: {
    isRealPhoto: { type: 'boolean' },
    personCount: { type: 'integer', minimum: 0 },
    childCount: { type: 'integer', minimum: 0 },
    primarySubjectIsChild: { type: 'boolean' },
    apparentAgeBand: { type: 'string', enum: AGE_BANDS },
    faceClearlyVisible: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string', enum: PHOTO_ISSUES } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
};

const CLASSIFY_PROMPT = [
  'You screen photos a parent uploads so an app can illustrate a story about their young child.',
  'Classify the image only. Do not identify, name, or describe any person, and do not describe facial features.',
  'isRealPhoto: true for a real camera photo; false for drawings, cartoons, illustrations, AI-generated images, screenshots of apps or videos, or photos of a screen.',
  'personCount: number of real, living people physically in the scene. childCount: how many of those appear younger than about 13.',
  'Count each person once. Do not count dolls, toys, stuffed animals, statues, drawings, posters, photos or screens within the photo, reflections in mirrors or windows, or shadows. If unsure whether something is a second child, do not count it.',
  'primarySubjectIsChild: true when a child is the main, most prominent subject.',
  'apparentAgeBand: rough apparent age of the most prominent child (infant <1, toddler 1–2, preschool 3–5, school_age 6–12); if there is no child, use teen or adult for the most prominent person, or none when there are no people.',
  'faceClearlyVisible: true when the most prominent child\'s face is visible and large enough to recognize as a face.',
  'issues: any of blurry, too_dark, face_too_small, face_covered, heavy_filter that apply.',
  'confidence: how confident you are in this classification overall.',
].join(' ');

export class PhotoCheckError extends Error {
  constructor(message, { code, status, photoErrors = [], help = null, result = null } = {}) {
    super(message);
    this.name = 'PhotoCheckError';
    this.code = code;
    this.status = status ?? (code === CODES.CHECK_UNAVAILABLE ? 503 : 422);
    this.photoErrors = photoErrors;
    this.help = help;
    this.result = result;
  }

  /** JSON body for API routes: { error, code, photoErrors, help }. */
  toResponseBody() {
    return { error: this.message, code: this.code, photoErrors: this.photoErrors, help: this.help };
  }
}

export function isPhotoCheckFailure(error) { return error instanceof PhotoCheckError || error?.name === 'PhotoCheckError'; }

/** API-route helper: a 422/503 Response for photo-check failures, otherwise null. */
export function photoCheckErrorResponse(error) {
  if (!isPhotoCheckFailure(error)) return null;
  return Response.json(error.toResponseBody(), { status: error.status });
}

/** Machine-readable code for a failed AI job when the failure was a photo check, else null. */
export function photoCheckErrorCode(error) { return isPhotoCheckCode(error?.code) ? error.code : null; }

/** "enforce" (default) or "off". Off is for local development without an OpenAI key. */
export function childPhotoCheckMode(env = process.env) {
  return String(env.CHILD_PHOTO_CHECK_MODE || '').trim().toLowerCase() === 'off' ? 'off' : 'enforce';
}

function toDataUrl(image) {
  if (typeof image === 'string') return image;
  return `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}`;
}

function responseText(payload) {
  for (const item of payload?.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) if (content.type === 'output_text' && content.text) return content.text;
  }
  return '';
}

async function postJson(url, body, { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, apiKey = process.env.OPENAI_API_KEY } = {}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

/**
 * OpenAI safety screen. Throws PhotoCheckError(PHOTO_UNSAFE) when flagged and a plain Error when
 * the service fails. `flaggedMessage` keeps each feature's existing wording.
 */
export async function moderatePhoto(image, { flaggedMessage, ...options } = {}) {
  const { response, payload } = await postJson(MODERATION_ENDPOINT, {
    model: 'omni-moderation-latest',
    input: [{ type: 'image_url', image_url: { url: toDataUrl(image) } }],
  }, options);
  if (!response.ok) throw new Error(payload.error?.message || `Photo safety check failed (${response.status}).`);
  if (payload.results?.[0]?.flagged) {
    throw new PhotoCheckError(flaggedMessage || photoCheckMessage(CODES.UNSAFE), { code: CODES.UNSAFE });
  }
  return { flagged: false };
}

/** Coerces model output into a well-formed classification (defensive against schema drift). */
export function normalizeChildPhotoClassification(raw = {}) {
  const count = (value) => Math.max(0, Math.min(50, Math.round(Number(value) || 0)));
  const personCount = count(raw.personCount);
  const childCount = Math.min(personCount, count(raw.childCount));
  return {
    isRealPhoto: raw.isRealPhoto !== false,
    personCount,
    childCount,
    primarySubjectIsChild: Boolean(raw.primarySubjectIsChild) && childCount > 0,
    apparentAgeBand: AGE_BANDS.includes(raw.apparentAgeBand) ? raw.apparentAgeBand : (personCount ? 'adult' : 'none'),
    faceClearlyVisible: Boolean(raw.faceClearlyVisible),
    issues: [...new Set((Array.isArray(raw.issues) ? raw.issues : []).filter((issue) => PHOTO_ISSUES.includes(issue)))],
    confidence: ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'medium',
  };
}

/** One structured vision call. Returns { classification, model, responseId }. */
export async function classifyPhoto(image, { model = process.env.CHILD_PHOTO_CHECK_MODEL || DEFAULT_MODEL, ...options } = {}) {
  const { response, payload } = await postJson(RESPONSES_ENDPOINT, {
    model,
    store: false,
    input: [{ role: 'user', content: [
      { type: 'input_text', text: CLASSIFY_PROMPT },
      { type: 'input_image', image_url: toDataUrl(image), detail: 'high' },
    ] }],
    text: { format: { type: 'json_schema', name: 'child_photo_check', strict: true, schema: CHILD_PHOTO_SCHEMA } },
  }, options);
  if (!response.ok) throw new Error(payload.error?.message || `Photo check failed (${response.status}).`);
  const output = responseText(payload);
  if (!output) throw new Error('Photo check returned no usable result.');
  return { classification: normalizeChildPhotoClassification(JSON.parse(output)), model, responseId: payload.id || null };
}

/**
 * Pure policy. Returns { status: 'passed' | 'rejected', code, severity, reasons }.
 * A passed result may still carry a warning code (e.g. PHOTO_FACE_UNCLEAR) for the UI to show.
 */
export function evaluateChildPhoto(input, policy = DEFAULT_CHILD_PHOTO_POLICY) {
  const result = normalizeChildPhotoClassification(input);
  const rules = { ...DEFAULT_CHILD_PHOTO_POLICY, ...policy };
  const maxBandIndex = AGE_BANDS.indexOf(rules.maxAgeBand);
  const reasons = [];

  let block = null;
  if (!result.isRealPhoto) block = CODES.NOT_REAL;
  else if (result.personCount === 0) block = CODES.NOT_A_CHILD;
  else if (result.childCount === 0) block = CODES.ADULT_ONLY;
  else if (result.childCount > 1 && !rules.allowMultipleChildren && rules.blockMultipleChildren) block = CODES.MULTIPLE_CHILDREN;
  else if (AGE_BANDS.indexOf(result.apparentAgeBand) > maxBandIndex) block = CODES.ADULT_ONLY;

  if (block) {
    reasons.push(block);
    if (rules.downgradeLowConfidence && result.confidence === 'low') {
      return { status: 'passed', code: block, severity: 'warning', reasons: [...reasons, 'low_confidence'] };
    }
    return { status: 'rejected', code: block, severity: 'block', reasons };
  }

  if (result.childCount > 1 && !rules.allowMultipleChildren) {
    return { status: 'passed', code: CODES.MULTIPLE_CHILDREN, severity: 'warning', reasons: [CODES.MULTIPLE_CHILDREN] };
  }
  if (!result.primarySubjectIsChild) reasons.push('child_not_main_subject');
  if (!result.faceClearlyVisible) reasons.push('face_not_visible');
  reasons.push(...result.issues);
  if (reasons.length) return { status: 'passed', code: CODES.FACE_UNCLEAR, severity: 'warning', reasons };
  return { status: 'passed', code: null, severity: null, reasons };
}

/**
 * Full check for one normalized JPEG (Buffer) or data URL.
 * Returns { status: 'passed' | 'rejected' | 'error' | 'skipped', code, severity, reasons, classification, model }.
 * Callers persist this result; assertChildPhotos() turns failures into a PhotoCheckError.
 */
export async function checkChildPhoto(image, { mode = childPhotoCheckMode(), policy, ...options } = {}) {
  if (mode === 'off') return { status: 'skipped', code: null, severity: null, reasons: [], classification: null, model: null };
  try {
    await moderatePhoto(image, options);
    const { classification, model } = await classifyPhoto(image, options);
    return { ...evaluateChildPhoto(classification, policy), classification, model };
  } catch (error) {
    if (isPhotoCheckFailure(error) && error.code === CODES.UNSAFE) {
      return { status: 'rejected', code: CODES.UNSAFE, severity: 'block', reasons: [CODES.UNSAFE], classification: null, model: 'omni-moderation-latest' };
    }
    return { status: 'error', code: CODES.CHECK_UNAVAILABLE, severity: 'retry', reasons: [String(error?.message || error).slice(0, 300)], classification: null, model: null };
  }
}

/**
 * Throws one PhotoCheckError covering every failing photo: 422 for rejections, otherwise 503 when
 * the check could not run. `checks` is [{ index, photoId?, result }] with results from
 * checkChildPhoto() (or stored rows). Warnings and skipped checks never throw.
 */
export function assertChildPhotos(checks, { language = 'en' } = {}) {
  const unavailable = checks.filter(({ result }) => result?.status === 'error');
  const rejected = checks.filter(({ result }) => result?.status === 'rejected');
  const failing = rejected.length ? rejected : unavailable;
  if (!failing.length) return;
  const code = failing[0].result.code;
  throw new PhotoCheckError(photoCheckMessage(code, language), {
    code,
    help: photoCheckHelp(language),
    photoErrors: failing.map(({ index, photoId = null, result }) => ({
      index, photoId, code: result.code, severity: photoCheckSeverity(result.code),
    })),
  });
}
