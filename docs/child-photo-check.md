# Child-photo check

Picture books and practice-story illustrations are drawn from photos of the child. Before any of
that work is queued, the server confirms each reference photo really is a photo of one young
child. A rejected photo returns an immediate, specific error and never uses a daily AI creation.

Toy play is not checked here. It looks for a toy and already returns `not_a_toy`.

## Where the check runs

| Moment | What happens |
| --- | --- |
| Upload for a book or story (`sourceKind` `picture_book` / `practice_story`) | `POST /api/family-assets/photos/direct-upload` (web + mobile) or a multipart upload checks the resized JPEG. A passing photo is saved with its result. A rejected photo is **not saved**, its temporary `incoming/` object is deleted, and the response is 422. |
| Saved photos chosen for a book or story | `requireChildPhotos()` runs in `POST /api/family-assets/picture-books` and `POST /api/family-assets/practice-stories` **before** the book is created or the job is queued. Stored results are reused. Photos never checked (general library or toy photos) are checked now and the result is stored. |
| Inside the AI job | The OpenAI safety screen still runs before illustration as a backup. A failure there sets `ai_generation_jobs.error_code`. |

## How a photo is judged

1. **Safety screen**: `omni-moderation-latest`. Flagged → `PHOTO_UNSAFE`.
2. **Classification**: one Responses API call (`CHILD_PHOTO_CHECK_MODEL`, default `gpt-5-mini`, `store: false`, image `detail: low`) with a strict JSON schema: real photo?, person count, child count, is a child the main subject?, rough age band, face visible?, quality issues, confidence. The model is told to classify only. It must never identify anyone or describe faces.
3. **Rules** (`evaluateChildPhoto`, `DEFAULT_CHILD_PHOTO_POLICY` in `apps/web/lib/child-photo-check.js`):

| Result | Code | Effect |
| --- | --- | --- |
| Drawing, cartoon, AI image, screenshot | `PHOTO_NOT_REAL` | Blocked |
| No people (pet, toy, scenery) | `PHOTO_NOT_A_CHILD` | Blocked |
| People but no child, or the child looks like a teen/adult | `PHOTO_ADULT_ONLY` | Blocked |
| More than one child | `PHOTO_MULTIPLE_CHILDREN` | Blocked (`allowMultipleChildren: false`) |
| Safety screen flagged it | `PHOTO_UNSAFE` | Blocked |
| Face hidden, too small, dark, blurry, or child not the main subject | `PHOTO_FACE_UNCLEAR` | **Warning**: saved and usable |
| The model itself reports low confidence on a block | same code | Downgraded to a warning |
| OpenAI unreachable | `PHOTO_CHECK_UNAVAILABLE` | 503, retry; nothing saved |

A parent holding the child passes. Ages are deliberately lenient (`maxAgeBand: 'school_age'`), because AI age estimates for children are imprecise and only clear teens/adults should be blocked.

## API contract

Rejections return **422**. An unavailable check returns **503**.

```json
{
  "error": "This photo doesn’t look like a photo of a child. Choose a clear photo of your child.",
  "code": "PHOTO_NOT_A_CHILD",
  "photoErrors": [{ "index": 1, "photoId": null, "code": "PHOTO_NOT_A_CHILD", "severity": "block" }],
  "help": "Tips: one child per photo, face clearly visible, good light, no filters."
}
```

- `index` is the photo's position in the request. For direct uploads it is the `photoIndex` the client sent. For practice stories, saved photos come first, then new uploads.
- `photoId` is set for saved photos.
- Send `language: "zh-CN"` (direct upload, picture books, practice stories) for Mandarin messages.
- Every photo returned by the photo APIs carries `childCheck: { status, code, severity }`. `status` is `unchecked | passed | rejected | error`. A passing photo may carry a warning code.
- A failed AI job returns `errorCode` (e.g. `PHOTO_UNSAFE`) from `GET /api/ai-jobs`.

Codes, severities, English/Mandarin messages and client helpers (`photoCheckDetails`, `splitPhotoProblems`, `photoCheckWarning`, `isRejectedChildPhoto`, `photoCheckJobMessage`) live in `packages/shared/src/photo-check.js`, so web and mobile show identical wording.

## Clients

- **Web** (`apps/web/src/tabs/studio.js`): shows "Uploading / Checking photo N of M…". Each selected photo gets a row (Checked ✓, warning, or the rejection reason) with **Remove**. New photos are added to the selection, so one rejected photo can be replaced without re-uploading the rest. Rejected saved photos are unselected and hidden. The AI wait dialog uses the shared message for photo failures.
- **Mobile** (`apps/mobile`): `uploadChildPhotos()` uploads and checks each photo, caching passes by uri for retries, and throws `PhotoCheckBlockedError`. `PhotoPicker` frames rejected photos in red with the reason. The story maker hides rejected saved photos. JavaScript-only, so it can ship with `eas update`.

## Data

Migration `apps/web/supabase/migrations/202610210001_child_photo_check.sql`:

- `family_saved_photos.child_check_status | child_check_code | child_check_result | child_check_model | child_checked_at`. `child_check_result` holds only `{ classification, reasons }`: counts, age band, issues, confidence.
- `ai_photo_checks`: one row per check, including rejected uploads that were never saved (`photo_id` null). Owner-only RLS. Use it to review false rejections: `select code, count(*) from ai_photo_checks where status = 'rejected' group by code;`
- `ai_generation_jobs.error_code`.

Local JSON mode stores the same fields on photos in `data/family-assets/photos.json` (no audit rows).

## Configuration

```env
OPENAI_API_KEY=...                 # required: the check is on by default
CHILD_PHOTO_CHECK_MODEL=gpt-5-mini # optional
CHILD_PHOTO_CHECK_MODE=            # "off" only for local development without an OpenAI key
```

## Release checklist

1. Apply `202610210001_child_photo_check.sql` (idempotent).
2. Set the environment variables above on the server.
3. There are no users yet, so start clean. Remove test photos made before the check existed:
   ```sql
   -- Supabase SQL editor. Deletes ALL saved family photos; projects keep their own copies.
   delete from public.family_saved_photos;
   ```
   Then empty the `family-assets/<profile_id>/photos/` and `incoming/` folders in Storage, and delete `apps/web/data/family-assets/photos*` locally.
4. Run `npm test` at the repo root, and `npx tsc --noEmit` in `apps/mobile`.
5. Smoke-test end to end with a private test set. Don't commit real children's photos.

| Photo | Expected |
| --- | --- |
| One child, face visible | Passes |
| Parent holding the child | Passes |
| Child in a dark room / far away | Passes with "Face hard to see" warning |
| Adult only | Blocked: `PHOTO_ADULT_ONLY` |
| Dog, toy, food, landscape | Blocked: `PHOTO_NOT_A_CHILD` |
| Cartoon or drawing of a child, screenshot | Blocked: `PHOTO_NOT_REAL` |
| Two siblings | Blocked: `PHOTO_MULTIPLE_CHILDREN` |
| Same flows with the story language set to 中文 | Messages in Mandarin |
| `OPENAI_API_KEY` unset or wrong (staging only) | 503 "couldn’t check this photo right now", nothing saved |

6. Ship web and mobile together (`eas update` for mobile).
7. After the first real uses, review `ai_photo_checks` for false rejections and tune `DEFAULT_CHILD_PHOTO_POLICY` if needed.
