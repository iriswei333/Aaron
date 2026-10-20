# Weekly Social Agent

The weekly social agent fetches ParentMap weekend family events with the native `seattle`, `eastside`, `north-sound`, `south-sound`, `greater-puget-sound`, and `pacific-northwest` region parameters. It reads detail pages, creates Mandarin captions and one short Mandarin highlight per event, and selects eight events: two each from Seattle and Eastside, and one from each remaining region. A region's events may fall on the same weekend day. The detail-page venue locality—not the discovery region—becomes the city in the roundup.

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

Normal runs use ParentMap's six region parameters directly. To run only a subset:

```bash
npm run social:weekly -- --regions seattle,eastside --dry-run
```

Only the six supported ParentMap slugs are accepted by `--regions`. Seattle's Child and DuckDuckGo are not mixed into normal region runs. The older venue-distance workflow is optional; enable it with `--venue-distance-filter` and override its 15-mile radius with `--max-distance-miles 25`.

To print every ParentMap candidate and its complete scoring breakdown for a region without generating images:

```bash
npm run social:weekly -- --regions seattle --list-scores --dry-run
```

The report includes total score, component scores, matched recommendation keywords, selected/rejected state, date, title, and event URL. The same data is saved as `candidateScores` in the weekly JSON manifest.

During fall, the recommendation score also recognizes Halloween-related wording: `halloween`, trick-or-treat and trunk-or-treat variants, haunted houses/forests/trails, `spooky`, costume parties/parades, Monster Mash/Dash, Boo events, ghost walks, witches, fright events, and English or Spanish Day of the Dead wording. A match adds 20 points and reports the `Halloween` keyword with the `seasonal Halloween trend` reason.

To use the legacy merged-provider and web-search fallback behavior, pass:

```bash
npm run social:weekly -- --normal-event-search --dry-run
```

`--no-venue-distance-filter` remains accepted for command compatibility. When distance filtering is explicitly enabled, Google Places is used when `GOOGLE_PLACES_API_KEY` is configured; otherwise the agent falls back to OpenStreetMap Nominatim.

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

## Import a hand-picked event set

Use `--events-file` when one weekly package combines several direct event URLs. The file must be a non-empty JSON array; every entry requires `url`, `city`, and either `date` or a `dates` array using `YYYY-MM-DD`. Optional fields such as `title`, `dateLabel`, `timeLabel`, `venue`, `venueAddress`, `summary`, and `highlights` override facts extracted from the source page. Multiple dates remain on one event poster through `dateLabel`.

```bash
npm run social:weekly -- \
  --events-file data/social-events-2026-10-17.json \
  --skip-images
```

This mode creates one individual poster prompt per event plus the usual all-events summary prompt. Poster filenames include the event title so multiple events in the same city and date cannot overwrite one another.

For a test run that writes one weekly roundup and generates only one sample poster:

```bash
npm run social:weekly -- --sample
```

To regenerate a poster that received negative feedback while keeping the same ParentMap region and day:

```bash
npm run social:weekly -- --regenerate seattle,2026-09-05
```

If the event itself is unsuitable, persist that feedback so future runs exclude it:

```bash
npm run social:weekly -- --reject-event "Event name|Reason for rejection"
```

The rejected-event registry is saved in `event-feedback.json` in the output directory. Matching uses only the punctuation-insensitive normalized event title and applies across every region and date. The optional second field stores the reason. Older `City|YYYY-MM-DD|Event name|Reason` records remain readable but are normalized to the same title-only rule. Repeat `--reject-event` for multiple events.

Use the `--regenerate Region,YYYY-MM-DD` flag more than once for multiple posters. Each request searches that region/day again and selects a different eligible event. When an alternate event is found, the matching `weekly-YYYY-MM-DD-roundup.md` file is regenerated too. The roundup includes only the eight selected events and lists each event's actual venue city, name, venue, and address. Add `--feedback "..."` to include the critique in the replacement prompt.

Generated manifests, prompts, and poster images are saved under `output/social-posts/` by default. Posters use a fixed 1024×1536 (2:3) template. The top banner contains the day/weekend headline and explicitly excludes city and region names; the location remains in the facts bar. Selection uses per-region quotas, not per-city quotas. Seattle and Eastside receive two posters, while North Sound, South Sound, Greater Puget Sound, and Pacific Northwest receive one each. Before generating images, the agent skips existing poster filenames when appropriate.

Normal weekend recommendation runs also create one `weekly-YYYY-MM-DD-all-events.png` summary poster using the same text-first two-column style as URL imports. It includes every matched weekend event with its exact date label and venue, independently of the eight-poster individual-event limit. Regenerating a weekend event refreshes this summary poster so it stays aligned with the updated event set. Forced single-event URL runs do not create a redundant summary image.

To generate posters from an existing roundup without fetching weekend events again, pass the roundup path:

```bash
npm run social:weekly -- --from-roundup output/social-posts/weekly-2026-09-19-roundup.md
```

The agent loads the companion `weekly-YYYY-MM-DD.json` manifest for the full event facts, including exact poster date/time/location fields that are not shown in the shortened roundup.

Partnership events can be configured in `lib/social-partnership-events.js`. Legacy city-based partnership records are mapped into their ParentMap region for normal weekly selection and still respect title rejection and duplicate-selection rules.
