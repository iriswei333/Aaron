# Family Saved Photos API

## Purpose

Provide each authenticated family with a private photo library that can be managed independently and reused by picture-book and toy-play workflows.

Every library photo is normalized to an orientation-corrected JPEG with a maximum 2048×2048 bounding box. The original upload must be JPEG, PNG, WebP, HEIC, or HEIF and no larger than 20 MB.

Project workflows copy a selected library photo into their own project storage. This intentional separation means:

- deleting a library photo does not break an existing picture book or saved toy plan;
- deleting a project does not unexpectedly remove a reusable family photo;
- each workflow keeps its existing lifecycle and cleanup behavior.

## Endpoints

### `GET /api/family-assets/photos`

Lists the authenticated family's photos, newest first.

```json
{
  "photos": [
    {
      "id": "uuid",
      "label": "Kai picture-book photo",
      "mimeType": "image/jpeg",
      "byteSize": 182430,
      "width": 1536,
      "height": 2048,
      "sourceKind": "picture_book",
      "createdAt": "2026-09-30T17:00:00.000Z",
      "updatedAt": "2026-09-30T17:00:00.000Z",
      "contentUrl": "/api/family-assets/photos/content?photoId=uuid"
    }
  ]
}
```

### `POST /api/family-assets/photos`

Uploads one reusable photo using `multipart/form-data`.

| Field | Type | Required |
| --- | --- | --- |
| `photo` | File | Yes |
| `label` | String, max 100 characters | No |

Returns `201 { "photo": FamilyPhoto }`.

### `PATCH /api/family-assets/photos`

Renames a library photo.

```json
{ "photoId": "uuid", "label": "Favorite train" }
```

### `DELETE /api/family-assets/photos?photoId={uuid}`

Deletes the independent library copy. Existing projects remain intact because they retain their own copies.

### `GET /api/family-assets/photos/content?photoId={uuid}`

Returns the private JPEG with `Cache-Control: private, no-store`. Authentication and database/storage row-level security protect access.

## Reuse contracts

### Picture books

`POST /api/family-assets/picture-books` accepts any combination of new `photos` files and `savedPhotoIds`, with 2–5 total photos. `savedPhotoIds` may be repeated form fields or one JSON array string.

```text
photos=<new File>
savedPhotoIds=["uuid-1", "uuid-2"]
```

Newly uploaded picture-book references are also copied into the reusable library with `sourceKind: "picture_book"`.

### Toy play

Both toy endpoints accept either a new `photo` file or one `savedPhotoId`:

- `POST /api/family-assets/toy-play/generate`
- `POST /api/family-assets/toy-plays`

When generation starts from a saved photo, the same `savedPhotoId` should be included in the subsequent save request. A newly uploaded toy photo is added to the reusable library only when the parent explicitly saves the play plan, with `sourceKind: "toy_play"`.

## Storage and ownership

Supabase objects use `family-assets/{profile_id}/photos/{photo_id}.jpg`. Metadata is stored in `family_saved_photos`, protected by a `profile_id = auth.uid()` row-level security policy. Local-development mode uses `data/family-assets/photos` and applies the same owner filtering in application code.
