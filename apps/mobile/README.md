# SproutCue Mobile

The iOS and Android app for SproutCue, built with [Expo](https://expo.dev) (SDK 57), React Native 0.86 and Expo Router.

It is one workspace in the SproutCue monorepo:

```text
apps/web/         Next.js web app + the API this app calls
apps/mobile/      ← this app
packages/shared/  plain JavaScript shared by web and mobile (@sproutcue/shared)
```

The app has no backend of its own. It calls the same `/api` routes as the web app and signs in to the same Supabase project.

> **Status:** phases 1–2 are done, and Today, Discover, playdates, Family (except chat) and Play Studio match the web app. Family chat, Facebook/Apple sign-in and native features come next. See [Roadmap](#roadmap).

---

## Prerequisites

- **Node.js 22+** and npm 10+
- **A Mac with Xcode 26** for the iOS Simulator and App Store builds
- **Android Studio** with an emulator, or a real Android phone
- Optional: the **Expo Go** app on your phone for quick testing

## Getting started

Everything installs from the **repo root**, not from this folder. npm workspaces put all packages in one root `node_modules`, so web and mobile share a single copy of React.

```bash
# 1. Install (repo root)
npm install

# 2. Configure the app
cp apps/mobile/.env.example apps/mobile/.env.local
#    then edit apps/mobile/.env.local (see "Environment variables")

# 3. Start the Expo dev server
npm run dev:mobile
```

In the Expo terminal, press **i** for the iOS Simulator, **a** for the Android emulator, or **w** for a browser preview. Or scan the QR code with Expo Go or your phone's camera.

You'll land on **Sign in**. Use an existing SproutCue account (email + password) or create one. New families go through the **welcome flow** first; families who already finished setup on the web go straight to the tabs. If the app server can't be reached after sign-in, you'll see "We couldn't reach SproutCue" with the address it tried.

**Preview mode:** if the Supabase variables are empty, the app skips sign-in so you can browse every screen. Nothing saves in this mode.

## Environment variables

Expo bakes variables that start with `EXPO_PUBLIC_` into the app at build time. Put them in `apps/mobile/.env.local`, which git ignores.

| Variable | What it is |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | The web app's API root, e.g. `https://your-domain/api` |
| `EXPO_PUBLIC_SUPABASE_URL` | Same Supabase project URL as `apps/web` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase **publishable** key. Never put the service-role key here: everything in the app can be read by anyone who downloads it. |
| `EXPO_PUBLIC_SITE_URL` | Optional. Public web address used in playdate share links (`…/share/playdate/<id>`). Defaults to `EXPO_PUBLIC_API_BASE_URL` without `/api`, which only works for people on your Wi‑Fi while testing. |

**Testing against your local web app:** a phone or emulator can't reach `127.0.0.1` on your Mac. Start the web app on your network and use your Mac's local IP address:

```bash
npm run dev:web:lan          # from the repo root
# then in apps/mobile/.env.local:
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3000/api   # your Mac's IP
```

The Android emulator can also use `http://10.0.2.2:3000/api`. Restart `npm run dev:mobile` after changing `.env.local`.

## Scripts

From the repo root:

| Command | Does |
|---|---|
| `npm run dev:mobile` | Start the Expo dev server |
| `npm test` | Shared-package tests + web unit tests |

From `apps/mobile`:

| Command | Does |
|---|---|
| `npm run ios` / `npm run android` / `npm run web` | Start and open a specific platform |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | Expo lint (sets up ESLint on first run) |
| `npx expo-doctor` | Check dependency versions against SDK 57 |

## Project structure

```text
apps/mobile/
├── app.json                   Expo config: name, app ID, icons, splash, plugins
├── .env.example               template for .env.local
├── assets/images/             app icon, splash, SproutCue mark, illustrations
└── src/
    ├── app/                   screens: every file is a route (Expo Router)
    │   ├── _layout.tsx        providers + which area is reachable (see "Navigation")
    │   ├── sign-in.tsx        email/password sign-in and sign-up
    │   ├── playdate/[id].tsx  one playdate: invitation, join / can't attend, edit, share, cancel, add to calendar
    │   ├── welcome/           family profile setup, one screen per step
    │   │   ├── _layout.tsx    holds the answers between steps
    │   │   ├── index.tsx      1 · Who's coming to play?
    │   │   ├── place.tsx      2 · Where do you usually play?
    │   │   ├── time.tsx       3 · When are you usually free?
    │   │   └── done.tsx       You're in! (family card preview, saves to the API)
    │   └── (tabs)/            the signed-in app (the folder name doesn't appear in URLs)
    │       ├── _layout.tsx    native bottom tabs (_layout.web.tsx for the browser preview)
    │       ├── index.tsx      Today: greeting + weather, intents, family plans or next adventure, story maker
    │       ├── discover.tsx   Discover: search location, filters, map / list, event + playground details, new playdate
    │       ├── studio.tsx     Play Studio: four creation cards, AI progress, recent creations
    │       └── family.tsx     Family: child card, your playdates, AI creations (+ detail sheets), sign out
    ├── components/
    │   ├── ui/                design-system components (see below)
    │   ├── brand/             SproutCue logo + wordmark
    │   ├── discover/          location panel, filters, map (discover-map.tsx native / .web.tsx preview), result cards, sheets
    │   ├── playdates/         create / edit form sheet, plan card, update banner
    │   ├── location/          location sheet (use my location or type a place)
    │   ├── family/            family card + live preview, child card, playdate/asset rows, story & play-idea sheets
    │   ├── today/             greeting, intent tiles, photo cards, family plans, adventure, story maker sheet
    │   ├── studio/            AI progress sheet + toast, photo picker, book cards, page viewer, private images
    │   └── welcome/           welcome-flow frame, field groups, draft state
    ├── constants/theme.ts     design tokens mirrored from apps/web/src/styles.css
    └── lib/
        ├── config.ts          reads the EXPO_PUBLIC_* variables
        ├── secure-storage.ts  Supabase session storage in the Keychain / Keystore
        ├── supabase.ts        Supabase client
        ├── session.tsx        SessionProvider / useSession(): session, profile, sign in/out
        ├── family-data.ts     useFamilyData(): playdates + AI creations for the Family tab, delete, refresh
        ├── today-data.ts      useTodayData(): playdates, saved plans, nearby playgrounds, weather; story create/save
        ├── photo-upload.ts    expo-image-picker (library / camera) + private upload to Supabase Storage
        ├── ai-jobs.tsx        AiJobsProvider / useAiJobs(): AI job progress, polling, notifications, open result
        ├── studio-data.ts     picture books, practice stories, toy play, saved photos, PDF sharing
        ├── discover-data.ts   useDiscoverData(): Discover results, filters, save/join/create, search location
        ├── location.ts        expo-location: permission, current position, address lookup, PUT /location
        ├── location-editor.ts useLocationEditor(): use my location / typed address → saved location (Today chip, Discover)
        ├── playdates.ts       usePlaydate(): join, respond, edit, cancel; share link; calendar invite (expo-sharing)
        └── api.ts             apiRequest(), shared loaders, image helpers
```

Keep only screens inside `src/app/`. Components, hooks and helpers go elsewhere in `src/`. Import with the `@/` alias, e.g. `import { Colors } from '@/constants/theme'`.

## Design system

**Tokens** (`src/constants/theme.ts`) are the web app's CSS custom properties translated to React Native: `Colors` (ink, muted, brand orange, paper, line, greens, sun), `Radius` (control 14, card 22, pill), `Spacing` (4-px scale), `Layout` (20-px gutter, 44-px minimum touch target, 720-px max width), `Type` (eyebrow, display, title, heading, body, small…), and `Shadow` (card, float, button). Change a value there to restyle the whole app.

**Components** (`import { … } from '@/components/ui'`):

| Component | Use it for | Web equivalent |
|---|---|---|
| `Screen` | Every page: safe area, paper background, page heading, optional pinned `footer` that stays above the keyboard | page layout |
| `SectionHeading` | Eyebrow + title + subtitle, optional `action` (e.g. `CountBadge`) | `.section-heading` |
| `Button` | `primary` (orange), `secondary` (white + warm border), `ghost` (text), `danger`; `size="sm"`, `loading`, `fullWidth` | `.rail-create`, `.secondary-button` |
| `Chip` / `ChipRow` | Static tags (`tone`: default, brand, green, sun) or toggles (pass `selected` + `onPress`) | `.family-chip-list span`, `.welcome-chip` |
| `Card` / `CardTitle` / `CardText` | Panels (`tone`: default, warm, green, brand); pass `onPress` to make one tappable | `.panel` |
| `Avatar` / `AvatarStack` | Initial-letter or photo avatars; `shape="rounded"` for the child avatar | `.family-child-avatar`, chat avatars |
| `TextField` | Labeled input with hint and error; 16-px text so iOS doesn't zoom | `.welcome-label input` |
| `Stepper` | − value + control (e.g. playdate radius) | range slider |
| `StepDots` | Welcome-flow progress | `.welcome-progress` |
| `Sheet` | Native detail sheet (iOS page sheet / Android full screen) with a pinned footer | `.modal-dialog` |

All interactive components are at least 44 px tall and set accessibility roles, labels and states.

## Navigation

`src/app/_layout.tsx` decides what's reachable, the same way the web app does:

| State | Reachable |
|---|---|
| Signed out | `sign-in` |
| Signed in, child profile not complete | `welcome/*` |
| Signed in and set up | `(tabs)/*`, plus `welcome/*` for **Edit family details** |

This uses Expo Router's `Stack.Protected`, so when the state changes (sign-in, finishing the welcome flow, sign-out) the app moves to the right place by itself. The splash screen stays up until the stored session and profile have loaded.

## Calling the API

```ts
import { apiRequest } from '@/lib/api';

const { user } = await apiRequest('/profile');
await apiRequest('/chat', { method: 'POST', body: { threadId, text: 'See you at 10!' } });
```

Ready-made loaders and helpers from the same file:

```ts
import { authorizedSource, discover, familyPlans } from '@/lib/api';

const results = await discover.loadDiscover({ /* same options as the web Discover tab */ });
await familyPlans.saveFamilyPlan(item);

// Photos and picture-book pages come back as server paths like /api/family-assets/photos/content?photoId=…
// and need the login token, so load them like this:
<Image source={await authorizedSource(photo.contentUrl)} />
```

`apiRequest` wraps `createApiClient` from `@sproutcue/shared`, the same client the web app uses. Plain-object bodies are sent as JSON, `FormData` uploads keep their own content type, and errors throw an `ApiError` with the server's message and HTTP status.

## Sign-in and session storage

- **Sign-in:** `sign-in.tsx` offers **Continue with Google**, **Email me a sign-in link** (the default email option, like the web app) and **Sign in with a password**, all the same accounts as the web app. Facebook and Sign in with Apple come in the sign-in phase.
- **How the magic link works** (`sendMagicLink` in `src/lib/oauth.ts`): Supabase emails a link; tapping it on the phone opens `sproutcue://auth/callback?code=…`, and `src/app/auth/callback.tsx` exchanges the code. A new email address gets a new account, as on the web. The link must be opened on the device that asked for it (PKCE); otherwise the parent can type the **code from the email** instead (`verifyEmailCode`).
- **How Google sign-in works** (`src/lib/oauth.ts`): Supabase builds the Google sign-in URL (PKCE), the app opens it in a secure in-app browser (`expo-web-browser`), Google sends the user back to `sproutcue://auth/callback?code=…`, and the app exchanges that one-time code for a session. If the phone opens the link as a deep link instead, `src/app/auth/callback.tsx` finishes the same way.
- **Where the session lives:** in the iOS Keychain / Android Keystore via `expo-secure-store` (`src/lib/secure-storage.ts`). Sessions can exceed SecureStore's ~2 KB value limit, so they're split into chunks by `createChunkedStorage` in `@sproutcue/shared` (unit-tested). In the browser preview, `localStorage` is used instead.
- **Calling the API:** `src/lib/api.ts` adds `Authorization: Bearer <access token>` to every request. The web API (`apps/web/lib/supabase/server.js`) accepts either browser cookies or this token, and Supabase's row-level security still applies.
- **In screens:** `const { user, session, onboarded, signOut, refreshProfile } = useSession();`

### One-time setup for Google sign-in

Google sign-in uses the Google provider your Supabase project already has for the web app, so no new Google Cloud credentials are needed. You only have to allow the app's return addresses:

1. Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**, add:
   - `sproutcue://auth/callback` (development builds and store builds)
   - `exp://**` (Expo Go while developing; remove it before launch if you like)
   - `http://localhost:8081/auth/callback` (browser preview)
2. Check that **Authentication → Providers → Google** is enabled (it is if web Google sign-in works).
3. Restart `npm run dev:mobile` and tap **Continue with Google**.

The same redirect URLs are used by **magic links**. Two optional email settings (Authentication → Emails → Templates → **Magic Link**):

- Keep `{{ .ConfirmationURL }}` in the template; that's the link that opens the app.
- Add `Or enter this code: {{ .Token }}` so parents who open the email on a computer can type the code into the app instead.

If Supabase sends you to the web app's home page instead of back to the app, the redirect URL in step 1 is missing. Supabase falls back to the project's Site URL.

> Keychain items survive deleting the app on iOS. If you need a clean start while testing, sign out before deleting the app.

## Using shared logic

Anything that doesn't touch the screen (date math, data normalizers, option lists, API calls) belongs in `packages/shared` so web and mobile behave the same:

```ts
import { formatPlayDateWindow } from '@sproutcue/shared/playdates';
import { STORY_LANGUAGE_OPTIONS, FAVORITE_INTEREST_OPTIONS } from '@sproutcue/shared/profile-defaults';
import { PRACTICE_STORY_CHALLENGES } from '@sproutcue/shared/practice-story-options';
import { normalizePlaydate } from '@sproutcue/shared/discover-normalizers';
import { createDiscoverClient } from '@sproutcue/shared/discover-client';
import { discoverKindLabel, familyEventPlan, geocodeAddress } from '@sproutcue/shared/discover-view'; // Discover labels, saved-plan payloads, address lookup
import { createFamilyPlansClient } from '@sproutcue/shared/family-plans-client';
import { buildWelcomeSave, validateWelcomeStep } from '@sproutcue/shared/onboarding'; // welcome flow, same as web
```

Rules for `packages/shared`: plain JavaScript only. No DOM, no React, no React Native, no Node-only modules. Add tests in `packages/shared/test/` (`npm test` runs them).

## Adding packages

Always add packages from this folder with:

```bash
npx expo install <package>
```

It picks the version that matches SDK 57. Plain `npm install` can pull a newer native version that crashes at runtime. Note that `expo install` needs network access to Expo's servers. If it's blocked, use the version listed in `node_modules/expo/bundledNativeModules.json`.

Two monorepo rules:

- **One React only.** The root `package.json` pins `react` and `react-dom` to `19.2.3` with `overrides`, matching Expo SDK 57. If you upgrade the Expo SDK, update that pin to the new React version, or the app will crash with "Invalid hook call".
- If a package ends up nested in `apps/mobile/node_modules` and something "cannot find module", try `npm dedupe` at the root.

## Play Studio

Same features and API calls as the web Play Studio (`apps/web/src/tabs/studio.js`, `apps/web/src/ai-jobs.js`). Routes live in `src/app/create/` (`/create/...`) so they don't collide with the Studio tab.

| Feature | Screens | API |
|---|---|---|
| A book starring them | Template chooser → `/create/books/new` (2–5 photos) → `/create/books/[id]` (make whole book or one page, read full screen, share PDF, delete) · library at `/create/books` | `picture-book-templates`, `picture-books`, `picture-book-pages`, `picture-book-assets`, `picture-book-pdf` |
| New play, same toys | `/create/toy` (one photo, English or 中文) → result opens on the Family tab | `toy-play/generate`, `toy-plays` |
| Little stories, big steps | `/create/story` (challenge, favorites, parent goals, theme, length, language, optional new or saved photos) → `/create/stories/[id]` reader | `practice-stories` |
| Read in your voice | "Coming soon" note, like the web | — |

- **Photos:** `expo-image-picker` (library, several at once, or camera). On iOS the picker exports HEIC as JPEG (`preferredAssetRepresentationMode: compatible`), and the API converts HEIC/HEIF too. Each photo uploads privately to Supabase Storage (`family-assets/{user}/incoming/…`) and is then filed with `POST /family-assets/photos/direct-upload`, exactly like the web, which keeps large photos off the API's request size limit. Limits: 20 MB each, 90 MB total.
- **AI progress:** creating anything returns a background job. A sheet shows a countdown and progress bar while the app polls `GET /ai-jobs?jobId=…` every 3 s (that request also starts a queued job on the server). **Leave and notify me** keeps polling; a toast appears when it's done, and **Open creation** goes straight to the book, story or play idea. Recent creations (`/notifications`) are listed on the Studio tab.
- **Viewers:** picture-book pages swipe full screen (images load with the session token); the finished book's PDF downloads and opens in the share sheet (Books, Files, Print). Stories read one scene per page with "Say it together" and "Try together", ending with "Talk about it" questions.
- Permission text for photos and camera lives in `app.json` (`expo-image-picker` plugin). Everything works in Expo Go.

## Playdates

Same flows and API calls as the web app (`apps/web/src/tabs/play.js`):

| What | Where | API |
|---|---|---|
| Create (public or private) | Discover → a playground → **＋ New playdate**, or the Playdates filter. Opens the new playdate afterwards so you can share it | `POST /playdates` |
| Join | Discover card **Join playdate**, or **Join this playdate →** on the playdate screen | `PUT /playdates` |
| Can't attend / Keep attending | Playdate screen (guests) | `PATCH /playdates` `{ action: 'respond' }` |
| Edit (public playdates you host) | Playdate screen → **Edit** | `PATCH /playdates` |
| Cancel (public playdates you host) | Playdate screen → **Cancel playdate** (asks first) | `DELETE /playdates` |
| Share the invite link | Playdate screen → **Share invite ↗**: the system share sheet with `{site}/share/playdate/<id>`, the web invitation page | — |
| Add to calendar | Playdate screen → **＋ Add to calendar**: writes an `.ics` invite (`expo-file-system`) and opens the share sheet for it (`expo-sharing`) so it can go to Calendar, Messages, Mail or Files | — |

- Open a playdate from Discover, from **Your playdates** on the Family tab, or with a link: `sproutcue://playdate/<id>` (in Expo Go: `exp://<your-mac-ip>:8081/--/playdate/<id>`). Signed-out links go to sign-in first.
- When a host changes a playdate you joined, a **Playdate update** banner shows until you dismiss it (remembered per profile, like the web).
- The link uses React Native's built-in share sheet, because `expo-sharing` only shares files. `expo-sharing` handles the calendar invite.
- Shared web links open the web invitation page. Opening them straight in the app needs universal links / app links, which come with store builds.

## Maps and location (Discover)

- **Map:** `react-native-maps` 1.27.2 — Apple Maps on iOS, Google Maps on Android. Pins are colored by kind, the selected pin turns orange, and the circle shows the family's search radius. Family events and story times without coordinates are placed with the phone's geocoder; anything still unplaced shows in List view. In the browser preview `discover-map.web.tsx` draws the same illustrative map as the web app (react-native-maps has no web support).
- **Where the location is set:** Discover shows the full location panel only until a location with map coordinates is saved; after that it's a one-line summary. To change it, tap the location chip on **Today** (use current location or type a place) or go to **Family → Edit family details** (neighborhood). Both save with `PUT /location`; a changed neighborhood gets its coordinates looked up, and an unchanged one isn't re-saved, so coordinates aren't lost.
- **Location:** `expo-location` asks for "While using the app" permission only when someone taps **Use my location**, reads one position fix, names the place with reverse geocoding, and saves it with `PUT /location` (same as the web). **Input address** uses the phone's geocoder first, then Nominatim / Open-Meteo.
- The permission text lives in `app.json` (`expo-location` plugin). Both modules ship with Expo Go, so no development build is needed yet.
- **Before an Android store build:** create a Google Maps SDK for Android key and add it to `app.json`:
  ```json
  ["react-native-maps", { "androidGoogleMapsApiKey": "YOUR_KEY" }]
  ```
  iOS uses Apple Maps and needs no key.

## Native projects and builds

- `ios/` and `android/` are generated by `npx expo prebuild` and git-ignored. `app.json` is the source of truth for the app name, app ID (`com.sproutcue.app`), icons and permissions, so change settings there, not in Xcode or Android Studio.
- **Expo Go** works for now, because the app only uses modules that ship with Expo Go. Once you add native modules Expo Go doesn't include (native Google sign-in, maps, push notifications), switch to a **development build**:
  ```bash
  npx expo run:ios        # needs Xcode
  npx expo run:android    # needs Android Studio
  ```
- **Store builds** will use EAS Build and EAS Submit. They aren't set up yet (`npx eas-cli build:configure` creates `eas.json`).

## Troubleshooting

| Problem | Fix |
|---|---|
| "We couldn't reach SproutCue" right after sign-in | Check `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env.local` and that `npm run dev:web:lan` is running; restart the dev server |
| Today's weather says "Location needed for weather" | Save a location with coordinates: Discover → **Use my location** or **Input address** |
| Google sign-in opens the SproutCue website instead of returning to the app | Add the redirect URLs from "One-time setup for Google sign-in" in Supabase |
| Magic link opens the website instead of the app | Same fix: add the redirect URLs above. In Expo Go, open the email on the phone that's running the app |
| "This sign-in was started somewhere else" | The link was opened on a different device or browser. Request a new link on this device, or type the code from the email |
| "Please wait 38 seconds before asking for another email" | Supabase limits how often emails are sent; the button counts down until you can resend |
| "Sign-in didn't finish: Invalid auth code" | The code expired or was used twice. Try again; if it keeps happening, restart the dev server |
| Stuck on "We couldn't reach SproutCue" after sign-in | The API URL is wrong or the web app isn't running; tap **Try again** after fixing it |
| Sign-in works but the welcome flow can't save | Check that `EXPO_PUBLIC_API_BASE_URL` points at the same Supabase project's web app |
| "Network request failed" on a phone | The API URL uses `localhost`/`127.0.0.1`. Use your Mac's local IP and start the web app with `-H 0.0.0.0` |
| `401 Sign in to access this profile.` | Your session expired. Sign out and back in |
| "Invalid hook call" / two copies of React | Run `npm ls react` at the root. There should be one `19.2.3` |
| "Unable to resolve react-native-maps" or "expo-location" | Run `npm install` at the repo root, then `npx expo start --clear` |
| "Use my location" says location is turned off | Allow location for Expo Go / SproutCue in the phone's Settings, or use **Input address** |
| Discover shows starter ideas instead of real playgrounds | The saved location has no coordinates. Use **Use my location** or an address the lookup recognizes |
| "Unable to resolve expo-sharing" | Run `npm install` at the repo root, then `npx expo start --clear` |
| A shared playdate link doesn't open for a friend | The link uses your Mac's LAN address while testing. Set `EXPO_PUBLIC_SITE_URL` to the deployed web app |
| "Unable to resolve expo-image-picker" | Run `npm install` at the repo root, then `npx expo start --clear` |
| Photo upload fails with a storage or policy error | Supabase Storage needs the `family-assets` bucket and the same upload policy the web uses; check that web uploads work for the same account |
| An AI creation stays at "Finishing up…" | The server finishes jobs when they're polled or by the AI worker; make sure `OPENAI_API_KEY` is set in `apps/web/.env.local` and check the web server logs |
| Odd bundler errors after moving files | `npx expo start --clear` |
| Browser preview can't call the API | Outside production, the web API already allows `http://localhost:8081`. In production, add the origin to `CORS_ALLOWED_ORIGINS` in `apps/web` |

## Roadmap

1. ~~Project setup: monorepo, Expo app, shared package, token auth on the API~~ ✅
2. ~~Foundations: design tokens, UI components, tabs + welcome flow + sign-in navigation, sessions in secure storage~~ ✅
3. **Sign-in:** ~~Google~~ ✅, ~~email magic links~~ ✅, Facebook, Sign in with Apple
4. **Screens:** ~~welcome flow + Family tab (except chat) + Today + Discover (maps, location) + playdates (create, join, edit, cancel, share, calendar) + Play Studio (photo uploads, AI job progress, picture-book and story viewers), matching the web design~~ ✅ → family chat
5. **Native features:** push notifications, share sheet, haptics, real SproutCue app icon and splash (the current ones are Expo's placeholders)
6. **Release:** EAS Build, TestFlight, Google Play closed test (12 testers for 14 days), store submission
