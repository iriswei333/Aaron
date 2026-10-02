# Asynchronous AI assets

## User experience

Play Studio generation requests return immediately with a durable job. The shared wait dialog shows:

- an estimated countdown and progress indicator;
- the user's daily usage count;
- a **Leave and notify me** action;
- success and failure states;
- an **Open creation** deep link when the job finishes while the dialog is open.

Leaving the dialog never cancels the job. A persistent notification button remains available throughout the signed-in app. Completion notifications open the new toy plan or practice story in Family, or the generated picture book in the picture-book library.

## Job API

Existing Play Studio endpoints now enqueue work and return HTTP `202`:

- `POST /api/family-assets/toy-play/generate` → `toy_play`
- `POST /api/family-assets/practice-stories` → `practice_story`
- `POST /api/family-assets/picture-book-pages` with `pageKey` → `picture_book_page`
- `POST /api/family-assets/picture-book-pages` with `wholeBook: true` → `picture_book_whole`

Response:

```json
{
  "job": {
    "id": "uuid",
    "jobType": "practice_story",
    "status": "queued",
    "progress": 0,
    "estimatedSeconds": 75,
    "createdAt": "2026-10-02T17:00:00.000Z"
  },
  "usage": { "used": 3, "limit": 10, "unlimited": false }
}
```

Poll `GET /api/ai-jobs?jobId={uuid}`. States are `queued`, `running`, `succeeded`, and `failed`. A successful result includes `assetId`, `assetType`, `title`, and `href`.

The authenticated polling endpoint opportunistically resumes a queued job. For durable unattended processing, call `GET` or `POST /api/ai-jobs/process` with `Authorization: Bearer $AI_JOB_WORKER_SECRET` from a scheduler. The worker uses `SUPABASE_SERVICE_ROLE_KEY`, processes one job per invocation, and requeues jobs left running for more than 15 minutes. Whole-book retries skip already completed pages.

## Daily quota

`enqueue_ai_generation_job` atomically reserves one slot and creates the job in one database transaction.

- Standard accounts: 10 queued AI creation requests per America/Los_Angeles calendar day.
- `iris333wei@gmail.com`: unlimited.
- `1111iris.iris@gmail.com`: unlimited.
- A whole-book request consumes one slot, not one slot per page.
- Rejected requests return HTTP `429` with `DAILY_AI_LIMIT_REACHED`.

The limit applies at enqueue time, so leaving the page or retrying network polling does not consume another slot.

## Notifications

- `GET /api/notifications` lists the newest 30 and returns `unreadCount`.
- `PATCH /api/notifications` with `{ "notificationId": "uuid" }` marks one read.
- Successful jobs create `ai_asset_ready`; failed jobs create `ai_asset_failed`.
- The browser refreshes notifications every 10 seconds while signed in.

## Persistence and recovery

`ai_generation_jobs`, `ai_daily_usage`, and `family_notifications` use profile-owned RLS. Job inputs contain IDs and text settings, never raw image bytes. Uploaded images are normalized into the private family photo library before enqueueing. Toy and practice-story assets store the originating `aiJobId` in metadata so a recovered worker does not create the same asset twice. Picture-book retries skip pages already marked ready.

## Deployment

Apply `202610020001_async_ai_jobs.sql`, then configure:

```env
SUPABASE_SERVICE_ROLE_KEY=...
AI_JOB_WORKER_SECRET=...
```

Schedule `/api/ai-jobs/process` frequently enough for the desired queue latency. The request-local `after()` hook starts work immediately; the scheduled worker supplies durable recovery.
