// Child-photo check contract shared by the API (apps/web) and both clients (web + apps/mobile).
// The server returns HTTP 422 { error, code, photoErrors, help } using these codes; clients use
// the same messages so wording stays identical in English and Mandarin.

export const PHOTO_CHECK_CODES = Object.freeze({
  NOT_A_CHILD: 'PHOTO_NOT_A_CHILD',
  ADULT_ONLY: 'PHOTO_ADULT_ONLY',
  NOT_REAL: 'PHOTO_NOT_REAL',
  MULTIPLE_CHILDREN: 'PHOTO_MULTIPLE_CHILDREN',
  UNSAFE: 'PHOTO_UNSAFE',
  FACE_UNCLEAR: 'PHOTO_FACE_UNCLEAR',
  CHECK_UNAVAILABLE: 'PHOTO_CHECK_UNAVAILABLE',
});

/** "block" stops the upload; "warning" may be overridden by the parent ("Use anyway"). */
export const PHOTO_CHECK_SEVERITY = Object.freeze({
  PHOTO_NOT_A_CHILD: 'block',
  PHOTO_ADULT_ONLY: 'block',
  PHOTO_NOT_REAL: 'block',
  PHOTO_MULTIPLE_CHILDREN: 'block',
  PHOTO_UNSAFE: 'block',
  PHOTO_FACE_UNCLEAR: 'warning',
  PHOTO_CHECK_UNAVAILABLE: 'retry',
});

const MESSAGES = {
  en: {
    PHOTO_NOT_A_CHILD: 'This photo doesn’t look like a photo of a child. Choose a clear photo of your child.',
    PHOTO_ADULT_ONLY: 'We couldn’t find a young child in this photo. Choose a photo where your child is the main person.',
    PHOTO_NOT_REAL: 'This looks like a drawing, screenshot, or edited image. Choose a real photo of your child.',
    PHOTO_MULTIPLE_CHILDREN: 'This photo has more than one child, so we can’t tell who the story is about. Choose a photo with just your child.',
    PHOTO_UNSAFE: 'This photo can’t be used. Choose a clear, everyday photo of your child.',
    PHOTO_FACE_UNCLEAR: 'Your child’s face is hard to see in this photo (too small, dark, or blurry). Results look best with a clear face.',
    PHOTO_CHECK_UNAVAILABLE: 'We couldn’t check this photo right now. Please try again in a moment.',
    help: 'Tips: one child per photo, face clearly visible, good light, no filters.',
  },
  'zh-CN': {
    PHOTO_NOT_A_CHILD: '这张照片看起来不是孩子的照片。请选择一张清晰的孩子照片。',
    PHOTO_ADULT_ONLY: '照片中没有找到小朋友。请选择以孩子为主角的照片。',
    PHOTO_NOT_REAL: '这看起来像是画作、截图或编辑过的图片。请选择孩子的真实照片。',
    PHOTO_MULTIPLE_CHILDREN: '照片里有不止一个孩子，我们无法确定故事的主角。请选择只有您孩子的照片。',
    PHOTO_UNSAFE: '这张照片无法使用。请选择一张清晰的日常孩子照片。',
    PHOTO_FACE_UNCLEAR: '照片中孩子的脸不太清楚（太小、太暗或模糊）。脸部清晰的照片效果最好。',
    PHOTO_CHECK_UNAVAILABLE: '暂时无法检查这张照片，请稍后再试。',
    help: '小提示：每张照片只有一个孩子，脸部清晰，光线充足，不加滤镜。',
  },
};

function lang(language) { return language === 'zh-CN' ? 'zh-CN' : 'en'; }

export function photoCheckMessage(code, language = 'en') {
  const table = MESSAGES[lang(language)];
  return table[code] || table.PHOTO_NOT_A_CHILD;
}

export function photoCheckHelp(language = 'en') { return MESSAGES[lang(language)].help; }

export function photoCheckSeverity(code) { return PHOTO_CHECK_SEVERITY[code] || null; }

export function isPhotoCheckCode(code) { return Object.prototype.hasOwnProperty.call(PHOTO_CHECK_SEVERITY, code); }

/** True for an ApiError / fetch result body carrying a child-photo check failure. */
export function isPhotoCheckError(errorOrBody) {
  const code = errorOrBody?.data?.code ?? errorOrBody?.code;
  return isPhotoCheckCode(code);
}

const SHORT_LABELS = {
  en: {
    PHOTO_NOT_A_CHILD: 'Not a child photo', PHOTO_ADULT_ONLY: 'No young child found', PHOTO_NOT_REAL: 'Not a real photo',
    PHOTO_MULTIPLE_CHILDREN: 'More than one child', PHOTO_UNSAFE: 'Can’t be used', PHOTO_FACE_UNCLEAR: 'Face hard to see',
    PHOTO_CHECK_UNAVAILABLE: 'Not checked yet',
  },
  'zh-CN': {
    PHOTO_NOT_A_CHILD: '不是孩子照片', PHOTO_ADULT_ONLY: '没有找到小朋友', PHOTO_NOT_REAL: '不是真实照片',
    PHOTO_MULTIPLE_CHILDREN: '不止一个孩子', PHOTO_UNSAFE: '无法使用', PHOTO_FACE_UNCLEAR: '脸部不清楚',
    PHOTO_CHECK_UNAVAILABLE: '尚未检查',
  },
};

/** A few words for a photo badge, e.g. "Not a child photo". */
export function photoCheckLabel(code, language = 'en') {
  const table = SHORT_LABELS[lang(language)];
  return table[code] || table.PHOTO_NOT_A_CHILD;
}

/**
 * Reads a photo-check failure from an ApiError ({ data }) or a response body.
 * Returns null for any other error, else { code, severity, message, help, photoErrors[] } with
 * localized messages on every photo error.
 */
export function photoCheckDetails(errorOrBody, language = 'en') {
  const body = errorOrBody?.data ?? errorOrBody;
  if (!isPhotoCheckCode(body?.code)) return null;
  const photoErrors = (Array.isArray(body.photoErrors) ? body.photoErrors : [])
    .filter((item) => isPhotoCheckCode(item?.code))
    .map((item) => ({
      index: Number.isInteger(item.index) ? item.index : null,
      photoId: item.photoId || null,
      code: item.code,
      severity: photoCheckSeverity(item.code),
      label: photoCheckLabel(item.code, language),
      message: photoCheckMessage(item.code, language),
    }));
  return { code: body.code, severity: photoCheckSeverity(body.code), message: photoCheckMessage(body.code, language), help: photoCheckHelp(language), photoErrors };
}

/**
 * Sorts photo errors onto what the parent picked: saved-library photos by id, new uploads by
 * position. `uploadedPhotoIds` is index-aligned with the new uploads (holes allowed);
 * `uploadOffset` is where new uploads start in the request's photo order.
 * Returns { saved: { [photoId]: problem }, uploads: { [uploadIndex]: problem } }.
 * @param {any} details result of photoCheckDetails()
 * @param {{ savedPhotoIds?: string[], uploadedPhotoIds?: (string | undefined)[], uploadOffset?: number }} [options]
 */
export function splitPhotoProblems(details, { savedPhotoIds = [], uploadedPhotoIds = [], uploadOffset = 0 } = {}) {
  const saved = {};
  const uploads = {};
  for (const problem of details?.photoErrors || []) {
    if (problem.photoId && savedPhotoIds.includes(problem.photoId)) saved[problem.photoId] = problem;
    else if (problem.photoId && uploadedPhotoIds.includes(problem.photoId)) uploads[uploadedPhotoIds.indexOf(problem.photoId)] = problem;
    else if (problem.index !== null && problem.index >= uploadOffset) uploads[problem.index - uploadOffset] = problem;
  }
  return { saved, uploads };
}

/** Warning carried by a saved photo (photo.childCheck), or null. */
export function photoCheckWarning(photo, language = 'en') {
  const check = photo?.childCheck;
  if (!check?.code || photoCheckSeverity(check.code) !== 'warning') return null;
  return { code: check.code, severity: 'warning', label: photoCheckLabel(check.code, language), message: photoCheckMessage(check.code, language) };
}

/** Saved photos that failed the check should not be offered for picture books or stories. */
export function isRejectedChildPhoto(photo) { return photo?.childCheck?.status === 'rejected'; }

/** Friendly text for a failed AI job when the failure was a photo check, else null. */
export function photoCheckJobMessage(job, language = 'en') {
  return isPhotoCheckCode(job?.errorCode) ? photoCheckMessage(job.errorCode, language) : null;
}
