# Practice Story API

`Little stories, big steps` creates a private, age-matched story around one family-selected goal and up to five child interests. The finished result is saved as a `practice_story` Family AI Asset.

## Endpoint

`POST /api/family-assets/practice-stories`

Use `multipart/form-data`:

- `goal` — required; one positive routine or skill, up to 120 characters.
- `interests` — required; comma-, semicolon-, or newline-separated interests; the first five are used.
- `language` — `en` or `zh-CN`, selected explicitly in the story-maker UI. If omitted by another client, the API falls back to the child's saved story language.
- `photo` — optional JPEG, PNG, WebP, HEIC, or HEIF file, up to 20 MB.
- `savedPhotoId` — optional alternative to `photo`, referencing the family's private saved-photo library.

The authenticated child's saved age and name are supplied by the server, not accepted from the client. Ages are constrained to the product's birth-to-five audience. If a photo is supplied, it is safety-checked and used to create a private square illustration of the child completing the goal. Without a photo, only story text is generated.

The response is `{ "asset": PracticeStoryAsset }`. Generation is atomic from the UI's perspective: a finished asset is returned and immediately appears in Family AI Assets.

`GET /api/family-assets/practice-stories` returns `{ assets, topics }`. `topics` contains age-banded goal suggestions; families can still enter a custom goal.

`GET /api/family-assets/practice-stories/content?storyId=...` streams an authenticated story illustration when one exists.

`DELETE /api/family-assets/practice-stories?assetId=...` permanently removes the authenticated family's story metadata and generated cover image. The Family AI Assets dialog asks for confirmation before calling it.

### Today playground stories

`GET /api/family-assets/practice-stories/playground` returns the three supported playground goals: making friends, washing hands, and leaving the playground.

`POST /api/family-assets/practice-stories/playground` accepts JSON shaped as `{ "goalId": "making-friends" }`. It creates an unsaved, approximately two-minute story using the authenticated child's saved name, age, interests, and story language. The response is `{ "story": PlaygroundStoryDraft }`.

`PUT /api/family-assets/practice-stories/playground` accepts the returned draft as `{ "story": PlaygroundStoryDraft }` and saves it as a private `practice_story` Family AI Asset. The server re-applies the authenticated child's profile and the canonical selected goal before saving. The response is `{ "asset": PracticeStoryAsset }`.

## Safety and developmental framing

The generator uses short, predictable scenes, positive rehearsal, caregiver support, and a non-coercive ending. It avoids shame, threats, diagnosis, treatment claims, and promises of perfect behavior. Suggested goals were informed by public guidance on family routines, everyday embedded learning, and developmentally appropriate independence from CDC, Head Start, and HealthyChildren.org; they are suggestions, not milestones or medical advice.

## Storage

Local development stores metadata in `data/family-assets/practice-stories.json` and optional covers under `data/family-assets/practice-stories/<id>/cover.png`. Supabase mode uses `family_assets`, `family_practice_story_assets`, and the private `family-assets` storage bucket. Apply `supabase/migrations/202609300004_family_practice_story_assets.sql` before enabling the feature in Supabase.
