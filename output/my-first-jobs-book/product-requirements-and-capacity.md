# Personalized career recognition book — product image requirements and capacity plan
Prepared September 21, 2026. All prices in USD. One product use means one personalized book for one child.

## Product definition
Deliver one square cover featuring four versions of the child (doctor, firefighter, police officer, astronaut), plus nine career pages: doctor, firefighter, police officer, astronaut, chef, teacher, pilot, scientist and race car driver. English/Simplified Chinese. Audience ages 0–3. Deliver individual PNGs and a 10-page digital PDF. Physical printing needs a separate printer-approved production specification and may require extra pages/back cover.

## Customer photo requirements
Request 4–6 recent original photos of the same child: a clear full-face portrait, left/right three-quarter views, a natural looking-down view, and a full-body image. Prefer a face at least 600 pixels tall, in focus, with even daylight and no filters, sunglasses, obscuring hats or wide-angle distortion. At least one neutral expression and one natural smile help establish features. Photos establish identity; generated expressions and angles follow the design plan below. Keep source references stable across an order. Ask the parent/guardian to confirm permission to use the photos; provide a deletion option and define retention before launch.

## Output specification
- Format: 1:1 square, white background, photorealistic child, soft realistic dress-up clothing, sparse pale illustrations.
- Preview target: 1024 × 1024 or larger. Current three revised sample images are 1254 × 1254; they are not 2400-pixel print masters.
- Proposed print target: 2400 × 2400 actual pixels for an 8 × 8 inch image area at 300 ppi. Bleed, trim, binding margins and color profile must follow the chosen printer. Changing DPI metadata alone does not add detail.
- Layout: interior art in upper approximately 70%; lower area reserved for four centered bilingual lines. Cover uses rainbow title, bilingual subtitle and pink age badge.
- Production workflow recommendation: generate artwork without embedded copy, then add approved Chinese/English typography using a reusable layout template. This makes spelling fixes independent of portrait regeneration.
- Export final PNGs in a consistent color space; embed fonts in PDF. Keep approved source artwork and versioned outputs.

## Identity and expression rules
Preserve the child's facial structure, natural eye shape, nose, cheeks, ears, hairline, skin tone and age. Use real photos as identity references only. Do not copy their expressions or camera angles. Generate the assigned expression with anatomically consistent brows, eyelids, cheeks, mouth, gaze and neck rotation. Keep natural skin texture and asymmetry; avoid enlarged eyes, porcelain skin, oversized heads and pasted-on faces.

A different costume or hand gesture does not count as a different expression. Each career must differ from its closest counterpart in at least two visible dimensions: mouth shape, eye/brow action, gaze or head orientation. Prompts request this; visual review must enforce it.

| Career | Required angle | Expression and gaze |
|---|---|---|
| Doctor | Full face | Gentle closed-lip smile; relaxed open eyes toward reader |
| Firefighter | Three-quarter left | Open-mouth laugh; cheeks raised, eyes narrowed naturally |
| Police officer | Looking down, slight right turn | Neutral closed mouth; focused on toy radio |
| Astronaut | Three-quarter right, slightly up | Quiet wonder; mildly raised brows, relaxed small O mouth |
| Chef | Looking down, slight left turn | Small contented asymmetric smile; watching mixing bowl |
| Teacher | Full face with gentle tilt | Encouraging mid-speech expression; attentive eyes |
| Pilot | Three-quarter right | Playful wink and closed-mouth grin |
| Scientist | Looking down, three-quarter left | Curious slight brow furrow; lips gently pressed |
| Race car driver | Full face, chin slightly raised | Proud tooth-showing grin, mouth nearly closed, eyes open |

Full face: approximately 0–10° yaw. Three-quarter: approximately 30–45° yaw. Looking down: approximately 15–25° chin depression, with enough face visible to recognize the child. These are composition targets, not guaranteed measurements.

## Repeatable generation process
1. Validate the uploaded photos and create a concise identity description.
2. Choose the nine expression/angle assignments before generation.
3. Generate one sample portrait; obtain customer likeness feedback before a full book.
4. Generate each career separately with stable references, model/settings and layout instructions.
5. Review all nine together for identity consistency and duplicated expressions.
6. Generate the four-career cover. Review four faces and hands independently.
7. Add exact bilingual text using the template, export pages and PDF, review at final size.
8. Regenerate only failed pages. Preserve accepted pages.
9. Log all attempts and billed usage, including revisions and any billed interrupted requests.

Proposed initial allowance per order: 10 base image generations + 5 extra attempts = 15 attempts. The five extras include likeness samples and revisions; this is a planning assumption, not a measured success rate or guaranteed sufficient allowance. Stress-test 20 and 30 attempts per book. Offer a defined revision scope rather than unlimited regeneration.

## Release acceptance criteria
Every page must show the correct child, intended career, assigned expression and angle, plausible anatomy, clean hands and props, coherent lighting, and legible exact bilingual text. No duplicated expression/angle pairs, unintended branding or watermarks, text collisions, or clipped faces. Parent reviews likeness; editor checks the complete set. Maintain a page-level pass/retry record.

## What we can measure now
The built-in image tool did not return token usage, explicit model identity or quality settings for the generated images. Exact tokens for the most recent three images, or the whole conversation, are therefore unavailable. The 1254-pixel outputs do not identify the internal token count.

Account snapshot during this request:
- Weekly shared Codex allowance: 12% used, 88% remaining; reset Sep 28, 2026 at 11:14 AM PDT.
- Five-hour shared allowance: 76% used, 24% remaining; reset Sep 21, 2026 at 8:30 PM PDT.
- No before-generation baseline was collected. The 12% cannot be attributed to this book.
- Two reset credits are visible, but are not included in recurring weekly capacity and were not redeemed.

Image generation shares general usage limits, and consumption varies by quality and size. These percentages are not a stated token balance. [Official usage explanation](https://learn.chatgpt.com/docs/pricing)

## Weekly capacity under the current subscription
Let d be the measured percentage-point decrease in WEEKLY remaining allowance for one complete accepted book, including revisions and orchestration. Then:
- Full-week theoretical capacity = floor(100 / d).
- Capacity from this snapshot = floor(88 / d).
- Capacity preserving 20 percentage points for other work = floor((88 - 20) / d).

| Hypothetical measured usage per book | Full weekly allowance | From 88% remaining | From 88%, preserving 20 points |
|---|---:|---:|---:|
| 2 percentage points | 50 | 44 | 34 |
| 5 percentage points | 20 | 17 | 13 |
| 10 percentage points | 10 | 8 | 6 |

These are scenarios, NOT observed production forecasts. The five-hour allowance may bind first and other account activity reduces capacity. Its percentage points cannot be compared directly with weekly percentage points.

To establish d, benchmark 3 complete representative books at fixed settings, with before/after usage snapshots and no concurrent account work. Do not measure across a reset. Divide the weekly decrease by accepted books; percentage rounding makes small samples noisy. Use a conservative higher-cost result when setting initial order limits. Record the five-hour change separately for scheduling. This benchmark is proposed, not performed.

## API token and cost benchmark
For a commercial service, use a metered API workflow so each order has traceable model/settings, usage and cost. Subscription percentages and API tokens are separate budgeting systems.

The official GPT Image 2 table provides a COMPARISON benchmark at 1024 × 1024: medium output approximately $0.053/image and high output approximately $0.211/image. Output tokens cost $30 per million, corresponding to roughly 1,800 or 7,000 output tokens respectively when inferred from rounded prices. These are not actual measurements of our images, not a quote for 2400-pixel print output, and not an assertion about the built-in tool's model. The current guide recommends GPT Image 2.5 models for new integrations; benchmark the chosen model rather than transfer the old model's per-image cost. [Official image generation guide](https://developers.openai.com/api/docs/guides/image-generation)

| Attempts per accepted book | Medium output-only benchmark | High output-only benchmark |
|---|---:|---:|
| 10 | $0.53 | $2.11 |
| 15 | $0.80 | $3.17 |
| 20 | $1.06 | $4.22 |
| 30 | $1.59 | $6.33 |

Input images, prompt tokens, orchestration, storage, human review, payment fees, printing and delivery are excluded.

Illustrative total generation estimate ONLY: assume each attempt uses 1,000 text input tokens, 6,000 image input tokens and high 1024-square output at approximately $0.211. Using $5/million text input and $8/million image input gives $0.005 + $0.048 + $0.211 = $0.264/attempt; 15 attempts = $3.96/book. These input counts are unmeasured assumptions and reference-heavy calls can cost more. This represents roughly 210,000 combined tokens/book under this scenario, with distinct token categories priced differently. Never convert that total directly to Codex weekly allowance. [Model pricing](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst)

At the illustrative $3.96 generation cost, a $100 API generation budget would fund floor(100 / 3.96) = 25 books, BEFORE other expenses and API rate-limit constraints. This is a budget scenario, not the capacity of your current subscription.

Actual API weekly capacity = minimum of budget capacity, account throughput capacity and review/fulfillment capacity. Budget capacity = floor(weekly API budget / measured generation cost per accepted book). Log the response usage and actual billing for each attempt; total all attempts per order. If a hard token budget is used, track text input, image input, cached input and image output separately.

## Recommended first product scope
Start with a digital 10-page book, fixed nine-career list, one four-career cover, a customer likeness proof and bounded revisions. Validate print output and unit economics separately before selling a physical book. Choose the production model only after comparing likeness acceptance, expression diversity, latency and cost on the same test photo sets.

