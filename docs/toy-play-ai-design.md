# New Play, Same Toys — product and technical design

## Goal

Let a parent photograph one toy, receive one short play idea matched to the saved child's age, review it, and explicitly save it to Family AI Assets.

The first version should optimize for a calm parent workflow, not exhaustive toy classification. It must handle “not a toy” and uncertain photos without inventing an activity.

## User flow

1. Open **Play Studio → New play, same toys**.
2. Choose one clear photo. The browser keeps the file locally until generation begins.
3. Tap **Make a play idea**.
4. The server moderates the image, analyzes the main toy, and returns a schema-constrained play plan using the child's saved age.
5. Review the toy identification, steps, variations, parent prompts, and safety notes.
6. Tap **Save to Family Assets** to persist the reviewed plan and photo. Generation alone does not create a family asset.

## API design

### `POST /api/family-assets/toy-play/generate`

Purpose: generate a preview without creating a Family Asset.

Request: `multipart/form-data`

| Field | Type | Notes |
| --- | --- | --- |
| `photo` | File | JPEG, PNG, WebP, HEIC/HEIF; max 20 MB |
| `language` | String | `en` or `zh-CN`; invalid values fall back to English |

The server derives the child's age from the authenticated family profile. It does not trust an age supplied by the browser.

Response:

```json
{
  "analysis": {
    "status": "ready",
    "message": "",
    "toy": {
      "name": "木制叠叠环",
      "category": "堆叠玩具",
      "description": "一个底座和几只彩色木环。",
      "confidence": "high"
    },
    "play": {
      "title": "彩色圆环送货员",
      "summary": "在搬运、说出颜色和堆叠圆环的游戏中一起玩。",
      "ageRange": "24–36 个月",
      "durationMinutes": 8,
      "developmentalGoals": ["精细动作", "颜色词汇"],
      "materials": ["叠叠环", "两个小容器"],
      "steps": ["..."],
      "parentPrompts": ["红色圆环应该送到哪里呢？"],
      "easierVariation": "...",
      "harderVariation": "...",
      "safetyNotes": ["先检查是否有松动或破损的部件。"],
      "supervision": "全程在孩子身边陪伴。"
    }
  },
  "childAgeMonths": 30,
  "language": "zh-CN",
  "model": "gpt-5",
  "responseId": "resp_..."
}
```

`status` may be `ready`, `not_a_toy`, or `uncertain`. Non-ready results contain an explanatory `message` and empty play fields.

Implementation uses the OpenAI Responses API with an image input and strict Structured Outputs. The image is normalized to JPEG and reduced to a maximum 1800×1800 before submission. `store: false` is set on the model request.

### `POST /api/family-assets/toy-plays`

Purpose: save a reviewed preview after the parent explicitly chooses Save.

Request: `multipart/form-data`

| Field | Type | Notes |
| --- | --- | --- |
| `photo` | File | Original browser-held photo |
| `analysis` | JSON string | Generated structured result |
| `language` | String | Language returned by the generation endpoint |
| `model` | String | Generation model for auditability |
| `responseId` | String | Optional OpenAI response identifier |

The server validates and normalizes the structured result again before persistence.

Response: `201 { "asset": FamilyToyPlayAsset }`

### `GET /api/family-assets/toy-plays`

Returns the authenticated family's saved toy-play assets, newest first. Row-level security and owner filtering prevent cross-family access.

## Model instructions and safety

- Identify only the main toy; never identify faces, people, brands, locations, or personal details.
- Derive age from the authenticated child profile.
- Generate one ordinary, low-setup activity rather than a list of generic ideas.
- Explicitly reject unclear photos and photos without a toy.
- Avoid choking hazards, unsafe climbing, projectiles, water hazards, heat, electricity, and medical/developmental claims.
- Include adult-supervision language and a pre-play physical toy inspection.
- Run image moderation before analysis.
- Treat model confidence as UX guidance, not a calibrated probability.

## Database design

`family_assets` remains the parent record and gains the `toy_play` asset type.

New table: `family_toy_play_assets`

| Column | Type | Purpose |
| --- | --- | --- |
| `asset_id` | UUID PK/FK | Cascades from `family_assets` |
| `photo_storage_path` | Text unique | Private `family-assets` bucket object |
| `photo_mime_type` | Text | Normalized image MIME type |
| `child_age_months` | Integer | Immutable age snapshot used for generation |
| `language` | Text | `en` or `zh-CN` output-language snapshot |
| `toy_name` | Text | Reviewed model identification |
| `toy_category` | Text | Broad toy category |
| `toy_description` | Text | Short visual description |
| `identification_confidence` | Enum-like check | `high`, `medium`, or `low` |
| `play_plan` | JSONB | Version-one structured plan |
| `model` | Text | Model used for generation |
| `response_id` | Text nullable | Provider trace identifier |
| timestamps | Timestamptz | Audit and ordering |

RLS permits access only when the linked `family_assets.profile_id` equals `auth.uid()`. The photo uses the existing private bucket and owner-prefixed storage path.

Future schema evolution should add `schema_version` before the JSON plan changes shape. A later version can move frequently queried fields such as duration or developmental goals into columns if analytics require them.

## UI design

### Play Studio

- The existing **New play, same toys** feature card opens an addressable `/play-studio?create=toy-play` workspace.
- Upload panel shows the selected photo, saved child age, accepted file types, and a single primary generation action.
- A bilingual language selector offers **English** and **中文（普通话）**. Mandarin generation returns Simplified Chinese toy details, instructions, prompts, variations, and safety notes.
- Before generation, a three-step explainer clarifies photo analysis, age matching, and explicit saving.
- Ready state contains:
  - identified toy and confidence label;
  - activity title, duration, and age range;
  - developmental-goal chips;
  - materials, numbered steps, and parent prompts;
  - easier/harder disclosure;
  - prominent grown-up safety check;
  - **Save to Family Assets** and **Try another toy** actions.
- Non-toy and uncertain states ask for a clearer photo without showing a fabricated plan.

### Family tab

The Family AI Assets card merges picture books and saved toy-play ideas by creation time. A saved toy idea displays its activity title, recognized toy, duration, age snapshot, and an English or 普通话 label. Unsaved previews never appear here.

## Operational notes

- Track generation latency, failure category, non-toy rate, uncertain rate, save conversion, and parent retry rate without logging image contents.
- Add evaluation fixtures for common toy categories and difficult cases: multiple toys, toy packaging, household objects, faces in frame, unsafe/broken toys, and age-inappropriate parts.
- Use idempotency keys on the save endpoint before enabling mobile retry/offline queues.
- If generation becomes slow, move analysis to a job with a short-lived upload and pollable status; preserve the explicit Save boundary.

## Official OpenAI references

- [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Moderation](https://developers.openai.com/api/docs/guides/moderation)
- [Data controls](https://developers.openai.com/api/docs/guides/your-data)
# Deleting a saved play idea

`DELETE /api/family-assets/toy-plays?assetId=...` permanently removes the authenticated family's saved play idea and its private copied toy image. The Family AI Assets popup asks for confirmation before calling it; reusable photos in the separate family photo library are not deleted.
