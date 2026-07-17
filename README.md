# Aaron Daily Life Planner

A small Next.js family planner for Aaron's daily routines. The app keeps separate family profiles and helps organize photo links, afternoon play plans, toddler meals, errands, outfit ideas, and social captions.

## Features

- Family profile login backed by Supabase Auth when configured, with a local JSON fallback for development
- Shared iCloud Photos link saving and local photo previews
- Afternoon play planning with saved location and Open-Meteo weather
- Toddler weekly menu, editable favorites, and shopping calendar downloads
- Amazon errands, diaper/wipe reminders, and outfit recommendation links
- Social post helper that selects photos or a video frame and drafts a caption
- Optional OpenAI-powered image caption generation with a local fallback

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

AI captions are optional. Without an API key, the app returns local fallback captions.

Add these if you want AI image captions:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_CAPTION_MODEL=gpt-4.1-mini
```

`OPENAI_CAPTION_MODEL` is optional. If omitted, the backend uses `gpt-4.1-mini`.

## Data Storage

When Supabase is configured, the backend stores signed-in user data in:

- `public.profiles`
- `public.social_posts`

Run the initial migration in Supabase:

```text
supabase/migrations/202607150001_initial_profiles.sql
```

When Supabase is not configured, the backend writes profile data and generated post history to:

```text
data/app-state.json
```

That file is ignored by `.gitignore`, but the current repository already has a tracked copy. Treat it as local development data and avoid committing private family information.

The app stores a few browser-local values such as login email and saved Apple Photos link in `localStorage`.

## Supabase Migration Path

1. Create a Supabase project and enable email magic-link auth.
2. Apply `supabase/migrations/202607150001_initial_profiles.sql`.
3. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable key.
4. Add your deployed `/auth/confirm` URL and local `http://localhost:3000/auth/confirm` or `http://127.0.0.1:3000/auth/confirm` URL to the Supabase auth redirect allow list.
5. Start the app and sign in with the email magic-link flow. The callback route exchanges Supabase `code` links for a server session, and also accepts `token_hash` links if you later use a custom email template.
6. Move existing local profile data from `data/app-state.json` into `public.profiles` if needed.
7. Deploy with the same env vars and keep `data/app-state.json` out of production.

## API Routes

- `GET /api/health` checks backend availability and reports auth mode and AI caption status.
- `GET /api/profile` returns the current signed-in profile.
- `PUT /api/profile` updates the current signed-in profile display name.
- `PUT /api/social-links` updates saved social links.
- `PUT /api/location` updates the saved location.
- `PUT /api/food-plan` updates favorite foods and menu data.
- `PUT /api/amazon-errands` updates errands and outfit ideas.
- `POST /api/social-media/caption` generates or falls back to a caption and stores the post record.
- `POST /api/auth/login` keeps the local JSON fallback working when Supabase is not configured.
- `POST /api/auth/logout` clears the local fallback profile cookie.

## Project Structure

```text
app/
  api/                 Next.js API routes
  layout.jsx           Root layout and metadata
  page.jsx             Client entry mount
lib/
  backend.js           Local store helpers and caption generation
  profile-session.js   Session-aware profile helpers for Supabase/local modes
  supabase/            Supabase client and middleware helpers
src/
  main.js              Planner UI and browser interactions
  styles.css           Application styles
data/
  app-state.json       Local profile/post data
```

## Notes

- Weather uses Open-Meteo from the browser after a profile has saved latitude and longitude.
- Uploaded photos and videos are previewed locally in the browser and are not uploaded unless used for optional AI caption generation.
- Calendar buttons generate `.ics` files in the browser for reminders and shopping blocks.
