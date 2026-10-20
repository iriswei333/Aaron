import { describe, expect, it, vi } from 'vitest';
import {
  assertChildPhotos,
  checkChildPhoto,
  childPhotoCheckMode,
  CHILD_PHOTO_SCHEMA,
  classifyPhoto,
  evaluateChildPhoto,
  moderatePhoto,
  normalizeChildPhotoClassification,
  PhotoCheckError,
} from '../lib/child-photo-check.js';

const KID = {
  isRealPhoto: true, personCount: 1, childCount: 1, primarySubjectIsChild: true,
  apparentAgeBand: 'preschool', faceClearlyVisible: true, issues: [], confidence: 'high',
};
const photo = Buffer.from('jpeg-bytes');

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function classificationResponse(classification) {
  return jsonResponse({ id: 'resp_1', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(classification) }] }] });
}
/** fetch mock: first call = moderation, second = classification. */
function mockOpenAi({ flagged = false, classification = KID, moderationStatus = 200, classifyStatus = 200 } = {}) {
  return vi.fn(async (url) => {
    if (url.endsWith('/moderations')) return jsonResponse({ results: [{ flagged }] }, moderationStatus);
    if (classifyStatus !== 200) return jsonResponse({ error: { message: 'upstream down' } }, classifyStatus);
    return classificationResponse(classification);
  });
}
const options = (fetchImpl, mode = 'enforce') => ({ mode, fetchImpl, apiKey: 'test-key' });

describe('evaluateChildPhoto', () => {
  it.each([
    ['a clear photo of one young child', KID, 'passed', null],
    ['an infant', { ...KID, apparentAgeBand: 'infant' }, 'passed', null],
    ['a school-age child (lenient on purpose)', { ...KID, apparentAgeBand: 'school_age' }, 'passed', null],
    ['a pet, toy, or scenery', { ...KID, personCount: 0, childCount: 0, primarySubjectIsChild: false, apparentAgeBand: 'none' }, 'rejected', 'PHOTO_NOT_A_CHILD'],
    ['adults only', { ...KID, personCount: 2, childCount: 0, primarySubjectIsChild: false, apparentAgeBand: 'adult' }, 'rejected', 'PHOTO_ADULT_ONLY'],
    ['a teenager', { ...KID, apparentAgeBand: 'teen' }, 'rejected', 'PHOTO_ADULT_ONLY'],
    ['a cartoon of a kid', { ...KID, isRealPhoto: false }, 'rejected', 'PHOTO_NOT_REAL'],
    ['siblings together', { ...KID, personCount: 2, childCount: 2 }, 'rejected', 'PHOTO_MULTIPLE_CHILDREN'],
  ])('%s → %s', (_label, input, status, code) => {
    const result = evaluateChildPhoto(input);
    expect(result.status).toBe(status);
    expect(result.code).toBe(code);
  });

  it('allows a parent holding the child', () => {
    expect(evaluateChildPhoto({ ...KID, personCount: 2, childCount: 1 }).status).toBe('passed');
  });

  it('warns instead of blocking when the face is unclear', () => {
    const result = evaluateChildPhoto({ ...KID, faceClearlyVisible: false, issues: ['too_dark'] });
    expect(result).toMatchObject({ status: 'passed', code: 'PHOTO_FACE_UNCLEAR', severity: 'warning' });
    expect(result.reasons).toEqual(['face_not_visible', 'too_dark']);
  });

  it('warns when a child is present but not the main subject', () => {
    expect(evaluateChildPhoto({ ...KID, personCount: 3, childCount: 1, primarySubjectIsChild: false }))
      .toMatchObject({ status: 'passed', severity: 'warning', reasons: ['child_not_main_subject'] });
  });

  it('downgrades a low-confidence block to a warning', () => {
    const result = evaluateChildPhoto({ ...KID, personCount: 0, childCount: 0, apparentAgeBand: 'none', confidence: 'low' });
    expect(result).toMatchObject({ status: 'passed', code: 'PHOTO_NOT_A_CHILD', severity: 'warning' });
    expect(result.reasons).toContain('low_confidence');
  });

  it('honors policy overrides', () => {
    expect(evaluateChildPhoto({ ...KID, childCount: 2, personCount: 2 }, { allowMultipleChildren: true }).status).toBe('passed');
    expect(evaluateChildPhoto({ ...KID, apparentAgeBand: 'school_age' }, { maxAgeBand: 'preschool' }).code).toBe('PHOTO_ADULT_ONLY');
    expect(evaluateChildPhoto({ ...KID, personCount: 0, childCount: 0, confidence: 'low' }, { downgradeLowConfidence: false }).status).toBe('rejected');
  });
});

describe('normalizeChildPhotoClassification', () => {
  it('clamps counts and drops unknown values', () => {
    expect(normalizeChildPhotoClassification({ personCount: 1, childCount: 4, apparentAgeBand: 'giant', issues: ['blurry', 'nope', 'blurry'], confidence: 'very' }))
      .toMatchObject({ personCount: 1, childCount: 1, apparentAgeBand: 'adult', issues: ['blurry'], confidence: 'medium' });
  });

  it('keeps the schema and normalizer in sync', () => {
    expect(Object.keys(normalizeChildPhotoClassification(KID)).sort()).toEqual([...CHILD_PHOTO_SCHEMA.required].sort());
  });
});

describe('OpenAI calls', () => {
  it('sends the photo to moderation and the structured classifier without storing it', async () => {
    const fetchImpl = mockOpenAi();
    const { classification } = await classifyPhoto(photo, { fetchImpl, apiKey: 'k', model: 'test-model' });
    expect(classification.childCount).toBe(1);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: 'test-model', store: false, text: { format: { type: 'json_schema', strict: true } } });
    expect(body.input[0].content[1]).toMatchObject({ type: 'input_image', detail: 'low' });
    expect(body.input[0].content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('keeps each feature’s flagged wording', async () => {
    const fetchImpl = mockOpenAi({ flagged: true });
    await expect(moderatePhoto(photo, { fetchImpl, apiKey: 'k', flaggedMessage: 'Toy only, please.' }))
      .rejects.toMatchObject({ name: 'PhotoCheckError', code: 'PHOTO_UNSAFE', message: 'Toy only, please.' });
  });
});

describe('checkChildPhoto', () => {
  it('passes a child photo', async () => {
    const result = await checkChildPhoto(photo, options(mockOpenAi()));
    expect(result).toMatchObject({ status: 'passed', code: null, model: expect.any(String) });
  });

  it('rejects a non-child photo with a code', async () => {
    const result = await checkChildPhoto(photo, options(mockOpenAi({ classification: { ...KID, personCount: 0, childCount: 0, apparentAgeBand: 'none' } })));
    expect(result).toMatchObject({ status: 'rejected', code: 'PHOTO_NOT_A_CHILD', severity: 'block' });
  });

  it('rejects a flagged photo without calling the classifier', async () => {
    const fetchImpl = mockOpenAi({ flagged: true });
    const result = await checkChildPhoto(photo, options(fetchImpl));
    expect(result).toMatchObject({ status: 'rejected', code: 'PHOTO_UNSAFE' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports an outage as a retryable error, not a rejection', async () => {
    const result = await checkChildPhoto(photo, options(mockOpenAi({ classifyStatus: 500 })));
    expect(result).toMatchObject({ status: 'error', code: 'PHOTO_CHECK_UNAVAILABLE', severity: 'retry' });
  });

  it('skips all calls when the mode is off', async () => {
    const fetchImpl = mockOpenAi();
    expect((await checkChildPhoto(photo, options(fetchImpl, 'off'))).status).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('enforces unless explicitly turned off', () => {
    expect(childPhotoCheckMode({})).toBe('enforce');
    expect(childPhotoCheckMode({ CHILD_PHOTO_CHECK_MODE: 'OFF' })).toBe('off');
    expect(childPhotoCheckMode({ CHILD_PHOTO_CHECK_MODE: 'log' })).toBe('enforce');
  });
});

describe('assertChildPhotos', () => {
  const passed = { status: 'passed', code: null };
  const rejected = { status: 'rejected', code: 'PHOTO_NOT_A_CHILD' };

  it('does nothing when every photo passes or only warns', () => {
    expect(() => assertChildPhotos([{ index: 0, result: passed }, { index: 1, result: { ...passed, code: 'PHOTO_FACE_UNCLEAR', severity: 'warning' } }])).not.toThrow();
  });

  it('throws one 422 listing every rejected photo', () => {
    let error;
    try {
      assertChildPhotos([
        { index: 0, result: passed },
        { index: 1, photoId: 'p-2', result: rejected },
        { index: 2, result: { ...rejected, code: 'PHOTO_ADULT_ONLY' } },
      ]);
    } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(PhotoCheckError);
    expect(error.status).toBe(422);
    expect(error.toResponseBody()).toEqual({
      error: expect.stringContaining('doesn’t look like a photo of a child'),
      code: 'PHOTO_NOT_A_CHILD',
      help: expect.any(String),
      photoErrors: [
        { index: 1, photoId: 'p-2', code: 'PHOTO_NOT_A_CHILD', severity: 'block' },
        { index: 2, photoId: null, code: 'PHOTO_ADULT_ONLY', severity: 'block' },
      ],
    });
  });

  it('throws a 503 when the check was unavailable', () => {
    expect(() => assertChildPhotos([{ index: 0, result: { status: 'error', code: 'PHOTO_CHECK_UNAVAILABLE' } }]))
      .toThrow(expect.objectContaining({ status: 503, code: 'PHOTO_CHECK_UNAVAILABLE' }));
  });

  it('reports rejections ahead of outages', () => {
    expect(() => assertChildPhotos([
      { index: 0, result: { status: 'error', code: 'PHOTO_CHECK_UNAVAILABLE' } },
      { index: 1, result: rejected },
    ])).toThrow(expect.objectContaining({ status: 422, code: 'PHOTO_NOT_A_CHILD' }));
  });

  it('ignores skipped checks', () => {
    expect(() => assertChildPhotos([{ index: 0, result: { status: 'skipped', code: null } }])).not.toThrow();
  });

  it('localizes the message', () => {
    expect(() => assertChildPhotos([{ index: 0, result: rejected }], { language: 'zh-CN' })).toThrow(/不是孩子的照片/);
  });
});
