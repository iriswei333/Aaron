# Weekly Social Agent

The weekly social agent fetches ParentMap weekend family events by region, creates Mandarin captions, and generates one social-post image per matched event.

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

For a no-image test:

```bash
npm run social:weekly -- --dry-run
```

Generated manifests, prompts, and poster images are saved under `output/social-posts/` by default.
