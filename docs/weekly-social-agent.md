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

For a no-image test:

```bash
npm run social:weekly -- --dry-run
```

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

Use the `--regenerate City,YYYY-MM-DD` flag more than once for multiple posters. Each request searches that city/day again and selects a different eligible event from the results. When an alternate event is found, the matching `weekly-YYYY-MM-DD-roundup.md` file is regenerated too. The roundup includes only the up-to-eight events represented by the poster set, lists each event’s city, name, and location without exact event times, uses one sentence of highlights per event, and is capped at 670 words. Add `--feedback "..."` to include the critique in the replacement prompt. Regeneration intentionally overwrites only the requested poster; all other existing posters remain skipped.

Generated manifests, prompts, and poster images are saved under `output/social-posts/` by default. Posters use a fixed 1024×1536 (2:3) reference-inspired template: navy top ribbon, rounded orange event card, cream weekend banner, family illustration, three event-specific feature tiles, navy date/time/location bar, green Mandarin call-to-action, and SproutCue footer pill. The feature tiles are derived from the event title, theme, highlights, description, and trend keywords rather than fixed generic copy. Only event content and a subtle city illustration vary. Event selection applies trend recommendations: regional state fairs receive a geographic boost; fall festivals, pumpkin events, harvest events, and Mid-Autumn Moon Festival/Moon Festival events receive seasonal boosts in fall; and story-time events receive an early-learning boost plus an age-fit boost when they welcome toddlers, preschoolers, or all ages. Matching keywords and recommendation reasons are written to the manifest and roundup. Poster selection uses a per-city quota: Seattle and Bellevue can receive two posters, while other cities default to one; each city’s quota is ranked by recommendation score rather than assuming Saturday first. Before generating images, the agent checks that directory and skips any poster whose expected `{city}-{date}.png` file already exists; the weekly limit is filled with other missing posters when available.

To generate posters from an existing roundup without fetching weekend events again, pass the roundup path:

```bash
npm run social:weekly -- --from-roundup output/social-posts/weekly-2026-09-19-roundup.md
```

The agent loads the companion `weekly-YYYY-MM-DD.json` manifest for the full event facts, including exact poster date/time/location fields that are not shown in the shortened roundup.

Partnership events can be configured in `lib/social-partnership-events.js`. A forced partnership event is injected for its exact city/date and receives priority over ordinary search results, while still respecting event rejection and duplicate-selection rules.
