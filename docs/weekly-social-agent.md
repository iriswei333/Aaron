# Weekly Social Agent

The weekly social agent fetches ParentMap weekend family events by region and day, reads the detail-page description when available, creates Mandarin captions and one short Mandarin highlight of 2–3 sentences per event, and generates at most 8 social-post images per week. When more than 8 events match, poster selection rotates across cities before taking a second day from any city. Each configured city has two slots: one Saturday highlight and one Sunday highlight.

## Activate the Python environment

Each time you open a new Terminal session, activate the repository environment first:

```bash
cd /Users/iriswei/Documents/AaronDaily
source .venv/bin/activate
```

If the environment has not been created yet:

```bash
cd /Users/iriswei/Documents/AaronDaily
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install openai
```

Set the API key in the same Terminal session, then run the agent:

```bash
export OPENAI_API_KEY="sk-your-key-here"
npm run social:weekly
```

With `OPENAI_API_KEY`, the agent translates and summarizes each event detail description into one short Mandarin highlight of 2–3 sentences. Set `OPENAI_HIGHLIGHTS_MODEL` to override the default model. If the key or request is unavailable, the agent uses a local content-based fallback.

Each run also groups the selected search results by location city and writes them to `family_event_cache` with the matching ParentMap location region and an `origin` of `weekly-social-agent`. Discover checks this shared city/weekend cache after its request-specific cache and before fetching providers again. In local mode the rows are written to `data/app-state.json`. To write scheduled production runs to Supabase, configure the server-only service role key alongside the project URL:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-server-only-service-role-key"
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or commit it to the repository. Social-agent rows remain fresh through the end of their event weekend, while normal Discover cache rows keep the shorter provider-refresh lifetime.

## Import every recommendation from a URL

Use `--recommendations-url` (or its `--events-url` alias) to import the dated event list from a ParentMap roundup page, generate posters with the existing SproutCue template, and save all imported events to the shared family-event cache:

```bash
npm run social:weekly -- \
  --recommendations-url "https://www.parentmap.com/things-to-do/the-weekender/"
```

Exclude one or more roundup entries by repeating `--exclude-event-url`. Exclusions are matched without query strings and regardless of a trailing slash, and are applied before recurring-event resolution or detail-page requests:

```bash
npm run social:weekly -- \
  --recommendations-url "https://www.parentmap.com/things-to-do/the-weekender/" \
  --exclude-event-url "https://www.parentmap.com/calendar/japan-week-bellevue-college-2025/" \
  --exclude-event-url "https://www.parentmap.com/calendar/bigfoot-kids-book-festival/"
```

The importer reads each listicle heading and its Date, Cost, Location, and summary fields. Direct `/calendar/` links are retained. For recurring `/series/` links, it opens the series page and selects the calendar occurrence whose URL matches the parsed event date, such as `/calendar/spooky-science-burke-museum/2026-10-02/`. It then reads the detail page for time and image metadata. A failed detail-page lookup does not discard the recommendation; the list-page facts are saved with a resolution warning in the manifest.

The manifest and family-event cache contain every valid imported event. The normal weekly individual-image limit still applies, so at most eight individual event posters are generated per run. The importer also generates one additional `recommendations-YYYY-MM-DD-all-events.png` roundup poster that lists every imported event with its date and venue in a single image. Recommendation imports use title-qualified individual filenames such as `seattle-2026-10-02-spooky-science-at-the-burke-museum.png`, preventing two events in the same city on the same date from overwriting each other. Add `--skip-images` or `--dry-run` to import and inspect the event data without generating images.

For a no-image test:

```bash
npm run social:weekly -- --dry-run
```

ParentMap venue-distance filtering is enabled by default with a 15-mile radius:

```bash
npm run social:weekly -- --dry-run
```

The agent opens each ParentMap event page, reads the venue from `tribe-block__venue__meta`, geocodes its full address, and prefers events inside the distance limit. Events with no venue or an address that cannot be geocoded remain ineligible. If no geocoded event is inside the radius, the agent ranks all geocoded ParentMap candidates by recommendation score and selects the highest-scoring event; equal scores are resolved in favor of the nearest venue. DuckDuckGo and Seattle's Child results are not used in this mode because they do not provide the required ParentMap venue block. Forced partnership events remain eligible independently of ParentMap. Override the radius with `--max-distance-miles`, for example `--max-distance-miles 25`.

To restore the original normal search behavior, including Seattle's Child and DuckDuckGo fallback results, disable the default filter:

```bash
npm run social:weekly -- --normal-event-search --dry-run
```

`--no-venue-distance-filter` is an equivalent opt-out. The older `--venue-distance-filter` flag remains harmless for command compatibility, although filtering is now already enabled by default. Google Places is used when `GOOGLE_PLACES_API_KEY` is configured; otherwise the agent falls back to OpenStreetMap Nominatim.

## Force one event from a URL

Use `--force-event-url`, `--city`, and `--date` together to generate a specific event instead of running normal event search:

```bash
npm run social:weekly -- \
  --force-event-url "https://redmondtowncenter.com/events/917-exotics-car-show" \
  --city Bellevue \
  --date 2026-10-03
```

The date may be outside the automatically calculated weekend. The agent reads the supplied page, creates one event slot for the requested city and date, and writes the usual manifest, roundup, prompt, and poster. If that city/date poster already exists, forced mode replaces it. Add `--skip-images` to create only the text artifacts, or `--dry-run` for a no-image test. All three forced-event arguments are required. A forced URL cannot be combined with `--from-roundup` or `--regenerate`.

Add `--save-partnership` to persist the extracted event in `lib/social-partnership-events.js` as well as run the forced generation:

```bash
npm run social:weekly -- \
  --force-event-url "https://bellevuewa.gov/events/autumn-moon-night-market" \
  --city Bellevue \
  --date 2026-10-03 \
  --save-partnership \
  --skip-images
```

The saved record is sanitized to the supported partnership fields and marked as a forced partnership recommendation. Running the same URL, city, and date again does not create a duplicate entry. Review the extracted title, time, venue, address, and description in the file after saving because third-party page markup can change.

For a test run that writes one weekly roundup and generates only one sample poster:

```bash
npm run social:weekly -- --sample
```

To regenerate a poster that received negative feedback while keeping the same city and day:

```bash
npm run social:weekly -- --regenerate Seattle,2026-09-05
```

If the event itself is unsuitable, persist that feedback so future runs exclude it:

```bash
npm run social:weekly -- --reject-event "Seattle|2026-09-05|Event name|Event location is too far from the recommended city"
```

The rejected-event registry is saved in `event-feedback.json` in the output directory. New records preserve the readable event title, store a normalized title for punctuation-insensitive matching, and save the fourth pipe-separated field as the reason, such as `duplicated events in the history posters` or `event location is too far from recommended city`. Titles with a location or content suffix such as `Event Series at Venue A` or `Downtown Issaquah Story Stroll: Watercress` also create a global event-family exclusion for the shared series, so another location or edition will not be selected. Older compact normalized records remain supported. Repeat `--reject-event` for multiple events; the normal event scoring and no-duplicate selection still apply to the remaining results.

Use the `--regenerate City,YYYY-MM-DD` flag more than once for multiple posters. Each request searches that city/day again and selects a different eligible event from the results. When an alternate event is found, the matching `weekly-YYYY-MM-DD-roundup.md` file is regenerated too. The roundup includes only the up-to-eight events represented by the poster set, lists each event’s city, name, venue, and detailed address without exact event times, uses one sentence of highlights per event, and is capped at 670 words. Add `--feedback "..."` to include the critique in the replacement prompt. Regeneration intentionally overwrites only the requested poster; all other existing posters remain skipped.

Generated manifests, prompts, and poster images are saved under `output/social-posts/` by default. Posters use a fixed 1024×1536 (2:3) reference-inspired template: navy top ribbon, rounded orange event card, cream weekend banner, family illustration, three event-specific feature tiles, navy date/time/location bar, green Mandarin call-to-action, and SproutCue footer pill. The feature tiles are derived from the event title, theme, highlights, description, and trend keywords rather than fixed generic copy. Only event content and a subtle city illustration vary. Event selection applies trend recommendations: regional state fairs receive a geographic boost; fall festivals, pumpkin events, harvest events, and Mid-Autumn Moon Festival/Moon Festival events receive seasonal boosts in fall; and story-time events receive an early-learning boost plus an age-fit boost when they welcome toddlers, preschoolers, or all ages. Matching keywords and recommendation reasons are written to the manifest and roundup. Poster selection uses a per-city quota: Seattle and Bellevue can receive two posters, while other cities default to one; each city’s quota is ranked by recommendation score rather than assuming Saturday first. Before generating images, the agent checks that directory and skips any poster whose expected `{city}-{date}.png` file already exists; the weekly limit is filled with other missing posters when available.

Normal weekend recommendation runs also create one `weekly-YYYY-MM-DD-all-events.png` summary poster using the same text-first two-column style as URL imports. It includes every matched weekend event with its exact date label and venue, independently of the eight-poster individual-event limit. Regenerating a weekend event refreshes this summary poster so it stays aligned with the updated event set. Forced single-event URL runs do not create a redundant summary image.

To generate posters from an existing roundup without fetching weekend events again, pass the roundup path:

```bash
npm run social:weekly -- --from-roundup output/social-posts/weekly-2026-09-19-roundup.md
```

The agent loads the companion `weekly-YYYY-MM-DD.json` manifest for the full event facts, including exact poster date/time/location fields that are not shown in the shortened roundup.

Partnership events can be configured in `lib/social-partnership-events.js`. A forced partnership event is injected for its exact city/date and receives priority over ordinary search results, while still respecting event rejection and duplicate-selection rules.
