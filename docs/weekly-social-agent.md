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

Generated manifests, prompts, and poster images are saved under `output/social-posts/` by default.
