# Aaron Daily Life Planner

A small Next.js family planner for Aaron's daily routines. The app keeps separate family profiles and helps organize photo links, afternoon play plans, toddler meals, errands, outfit ideas, and social captions.

## Features

- Family profile login backed by a local JSON store
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
- Local JSON persistence in `data/app-state.json`
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

AI captions are optional. Without an API key, the app returns local fallback captions.

Create a `.env.local` file if you want AI image captions:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_CAPTION_MODEL=gpt-4.1-mini
```

`OPENAI_CAPTION_MODEL` is optional. If omitted, the backend uses `gpt-4.1-mini`.

## Data Storage

The backend writes profile data and generated post history to:

```text
data/app-state.json
```

That file is ignored by `.gitignore`, but the current repository already has a tracked copy. Treat it as local development data and avoid committing private family information.

The app also stores a few browser-local values such as the signed-in user id, login email, and saved Apple Photos link in `localStorage`.

## API Routes

- `GET /api/health` checks backend availability and reports whether AI captions are configured.
- `GET /api/users` lists saved user summaries.
- `POST /api/users` creates a user profile.
- `POST /api/auth/login` finds or creates a profile by email.
- `GET /api/users/:userId/profile` returns a full profile.
- `PUT /api/users/:userId/social-links` updates saved social links.
- `PUT /api/users/:userId/location` updates the saved location.
- `PUT /api/users/:userId/food-plan` updates favorite foods and menu data.
- `PUT /api/users/:userId/amazon-errands` updates errands and outfit ideas.
- `POST /api/users/:userId/social-media/caption` generates or falls back to a caption and stores the post record.

## Project Structure

```text
app/
  api/                 Next.js API routes
  layout.jsx           Root layout and metadata
  page.jsx             Client entry mount
lib/
  backend.js           Local store helpers and caption generation
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
