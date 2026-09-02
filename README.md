# SproutCue

A small Next.js daily planner for parents of young kids. The app keeps separate parent profiles, captures each child's setup details, and helps organize play, saved weekend events, social resources, and private family chat.

## Weekly social-post agent

The social-post generator runs outside the web app. It checks the existing ParentMap weekend-event logic separately for Saturday and Sunday in Seattle, Bellevue, Tacoma, Kirkland, Lynnwood, and Edmonds. It reads matched event detail descriptions, then uses the OpenAI API to translate and generate one short Mandarin highlight of 2–3 sentences per event when `OPENAI_API_KEY` is available. If ParentMap has no parsed event for a day, it tries DuckDuckGo web search and labels that source separately. It selects up to two highlights per region, writes Mandarin captions and source metadata, generates a Mandarin roundup Markdown post, and generates at most 8 4:5 PNG posters per week.

```bash
npm run social:weekly -- --dry-run
npm run social:weekly -- --regions Seattle,Bellevue --output output/social-posts
npm run social:weekly -- --sample
```

Image generation requires `OPENAI_API_KEY`. The command uses the bundled GPT Image CLI; set `IMAGE_GEN=/path/to/image_gen.py` if the default Codex skill path is different. Use `--sample` to write one weekly roundup and generate only one sample poster. A weekly run is saved as `weekly-YYYY-MM-DD.json`, with prompts in the matching `.jsonl` file and generated posters in the same output directory. Use cron, launchd, or GitHub Actions to run it weekly.

See [docs/weekly-social-agent.md](docs/weekly-social-agent.md) for environment activation and setup instructions.

## Features

- Parent profile login backed by Supabase Auth when configured, with a local JSON fallback for development
- Multi-child onboarding for nickname, age or birthday, home city, favorite activities, caption preferences, and caption privacy
- Playground discovery with saved location, Open-Meteo weather, weekend family events, public/private play dates, and public play-date joining
- Attend buttons for weekend events; attended events persist as Home family objects and link back to the Play weekend-events section
- Social tab with private playdate chat, media sharing, and age-matched parenting resources cached for one day
- Home background picker with local-session uploads and family event objects positioned over the hero background
- Social post helper that drafts captions locally from the parent’s selected preferences

## Tech Stack

- Next.js 15
- React 19
- Node.js API routes
- Supabase Auth and Postgres for production profile data
- Local JSON persistence in `data/app-state.json` when Supabase environment variables are not configured
- Plain JavaScript and CSS for the client experience

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The app runs on `http://127.0.0.1:3000` by default.

Build for production:

```bash
npm run build
```

Start a production build:

```bash
npm run start
```

## Environment Variables

Supabase is optional in local development, but required for production user auth and datastore.
Without Supabase variables, the app falls back to the local JSON profile store.

Create a `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

## Data Storage

When Supabase is configured, the backend stores signed-in user data in:

- `public.profiles`
- `public.social_posts`
- `public.play_dates`
- `public.play_date_participants`
- `public.family_event_cache`
- `public.playground_cache`
- `public.parenting_resource_cache`
- `public.family_events` stores saved external weekend-event decisions only

Apply all migrations in `supabase/migrations/` in filename order. The current sequence includes:

```text
supabase/migrations/202607150001_initial_profiles.sql
supabase/migrations/202607200001_play_dates.sql
supabase/migrations/202607220001_child_profile.sql
supabase/migrations/202607220002_multiple_children.sql
supabase/migrations/202607220003_family_event_cache.sql
supabase/migrations/202607280001_chat.sql
supabase/migrations/202607290001_playground_cache.sql
supabase/migrations/202607290002_playdate_chat_participants.sql
supabase/migrations/202607290003_playdate_chat_profile_visibility.sql
supabase/migrations/202608050001_remove_legacy_amazon_errands.sql
supabase/migrations/202608050003_parenting_resource_cache.sql
supabase/migrations/202608190001_deprecate_legacy_family_planning.sql
```

When Supabase is not configured, the backend writes profile data, generated post history, saved weekend-event decisions, play dates, and local cache entries to:

```text
data/app-state.json
```

That file is ignored by `.gitignore`, but the current repository already has a tracked copy. Treat it as local development data and avoid committing private family information.

The app stores a few browser-local values such as the login email and selected Home background in `localStorage`.

## Supabase Migration Path

1. Create a Supabase project and enable email magic-link auth.
2. Apply `supabase/migrations/202607150001_initial_profiles.sql`.
3. Apply every remaining migration in filename order through `supabase/migrations/202608050003_parenting_resource_cache.sql`.
4. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable key.
5. Add your deployed `/auth/confirm` URL and local `http://localhost:3000/auth/confirm` or `http://127.0.0.1:3000/auth/confirm` URL to the Supabase auth redirect allow list.
6. Start the app and sign in with the email magic-link flow. The callback route exchanges Supabase `code` links for a server session, and also accepts `token_hash` links if you later use a custom email template.
7. Move existing local profile data from `data/app-state.json` into `public.profiles` if needed.
8. Deploy with the same env vars and keep `data/app-state.json` out of production.

## API Routes

- `GET /api/health` checks backend availability and reports auth mode.
- `GET /api/profile` returns the current signed-in parent profile and children.
- `PUT /api/profile` updates the current signed-in profile display name, children, and active child.
- `PUT /api/social-links` updates saved social links.
- `PUT /api/location` updates the saved location.
- `GET /api/family-events` returns cached weekend family events for the profile city and current weekend; `refresh=1` forces a refresh. The server cache lasts 12 hours.
- Saved weekend-event decisions persist through `/api/family-plans`.
- `GET /api/playdates?playgroundKey=...` returns upcoming visible play dates for a selected playground.
- `POST /api/playdates` creates a public or private play date at the selected playground.
- `PUT /api/playdates` joins an existing public play date using `playDateId` from `public.play_dates`.
- `PATCH /api/playdates` edits a hosted public play date or records an attendee response (`joined` or `declined`).
- `DELETE /api/playdates` cancels a hosted public play date without removing it from attendee history.
- `GET /api/parenting-resources` returns age-matched articles from the daily database cache; `refresh=1` forces a refresh.
- `DELETE /api/account/delete` deletes the signed-in parent’s SproutCue profile data and associated app records.
- `POST /api/auth/login` keeps the local JSON fallback working when Supabase is not configured.
- `POST /api/auth/logout` clears the local fallback profile cookie.

The sign-in page links to the in-app privacy policy at `/privacy`. Replace its placeholders before production launch.

## Project Structure

```text
app/
  api/                 Next.js API routes
  layout.jsx           Root layout and metadata
  page.jsx             Client entry mount
lib/
  backend.js           Local store helpers and profile/play-date persistence
  family-events.js     Server-side family event fetching, parsing, fallback links, and cache keys
  profile-session.js   Session-aware profile helpers for Supabase/local modes
  supabase/            Supabase client and middleware helpers
src/
  main.js              Sign-in, child onboarding, planner UI, and browser interactions
  styles.css           Application styles
data/
  app-state.json       Local profile/post data
```

## Notes

- Weather uses Open-Meteo from the browser after a profile has saved latitude and longitude.
- Weekend family events are fetched server-side only. The API uses the saved profile city or location city, queries ParentMap and Seattle's Child (using a saved ZIP when available), caches merged results for 12 hours, and falls back to clearly labeled search links when no parsed event cards are available.
- Parenting resources are fetched and parsed server-side by child age group, then cached in `parenting_resource_cache` for 24 hours. Social’s Refresh button bypasses that cache.
- Meal planning, grocery shopping events, and recurring family-logistics events were retired in the 202608190001 cutoff migration. The migration removes their stored profile/table data and narrows saved family events to external weekend events.
- Photos and videos selected for local caption drafting are previewed locally in the browser. Media is uploaded only when the parent explicitly shares it in parent-to-parent chat.
