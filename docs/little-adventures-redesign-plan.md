# SproutCue redesign plan

## Product direction

Redesign SproutCue around one promise:

> Find a little adventure, enjoy it together, and keep the play going at home.

The current application already supplies most of the difficult operational pieces: authentication, family profiles, location, weather, playground discovery, story times, weekend events, public and private playdates, chat, privacy controls, and persistent storage. The Little Adventures prototype supplies a clearer parent journey, stronger mobile navigation, more focused writing, and a home for the planned AI features.

The redesign should combine those strengths. It should not port the static prototype literally or discard working product behavior.

## Executive gap assessment

| Area | Current application | Example UI | Redesign implication |
| --- | --- | --- | --- |
| Product story | A family planner with play, chat, resources, profiles, and social-post utilities | A companion for finding and extending toddler adventures | Use the prototype's story as the organizing principle for the current capabilities |
| Primary task | Split between making a playdate, checking nearby places, and family planning | “What shall we do together today?” | Make a useful next action or saved plan the first thing parents see |
| Navigation | Home, Play, Chat, Family, plus a global New playdate action | Today, Discover, Play Studio, Family | Adopt the prototype's four destinations; move Chat and New playdate into contextual flows |
| Discovery | One dense Play workspace contains playdates, playgrounds, story times, events, holidays, weather, and map | Category filters with a map/list switch and a selected-result card | Preserve the live sources but split them into a task-focused Discover experience |
| Saved plans | Playdates and attended events appear in several places | Saved plans surface at the top of Today | Consolidate future commitments into one reusable Plans module on Today |
| AI play tools | Not implemented in the current product | Four clear concepts with interactive demos | Add Play Studio as a new product area; ship tools one at a time behind real APIs |
| Social | Full chat plus parenting articles; playdate conversations are functional | Social is implicit in playdates and plans | Keep chat, but open it from a playdate or Today plan instead of making it a primary destination |
| Onboarding | Real authentication and a detailed five-step family/social setup | Visually simple sign-in plus three steps focused on child, interests, and neighborhood | Preserve real auth and safety settings while shortening required setup and deferring optional preferences |
| Visual system | Warm cream dashboard, orange accent, many rounded panels, dense text, small controls | Dark green, spacious white canvas, stronger hierarchy, simpler cards, fixed mobile nav | Create shared tokens and components using the prototype's hierarchy, with fewer competing accent colors |
| Data maturity | Real APIs, persistent accounts, live/fallback locations, error states | Session-only sample data and illustrative locations | Connect the new screens to existing APIs; never replace production behavior with prototype state |

## Functional findings

### What should be preserved

1. **Authentication and persistence.** The current email/Supabase flow, profile storage, local fallback, and account lifecycle are production capabilities absent from the prototype.
2. **Location and nearby discovery.** The current application already handles current-location permission, manual address entry, weather, search radius, live map support, fallback map searches, and failure messages.
3. **Playdate lifecycle.** Creating, joining, editing, declining, cancelling, sharing, and chatting around playdates should remain intact.
4. **Real discovery sources.** Playground results, story times, weekend event aggregation, caching, and saved attendance should power the new Discover screen.
5. **Safety controls.** Visibility, blocked families, city-level versus precise location behavior, private playdates, and profile privacy should stay explicit and testable.
6. **Multiple-child support.** The active-child model should remain, even though the prototype only demonstrates one child.

### What should change

1. **Home should become Today.** It should begin with saved or joined plans. With no plan, it should offer one useful local suggestion and the three paths: go somewhere, meet playmates, or play at home.
2. **Play should become Discover.** The current Play tab has the right data but too many sections in one continuous mobile page. Replace it with category filters, map/list views, selected-result details, and contextual actions.
3. **Add Play Studio.** This becomes the destination for toy-photo play ideas, personalized routine stories, learning books, and parent narration. It should not contain saved outing cards.
4. **Make Chat contextual.** A parent opens the relevant playdate conversation from Today, a playdate detail screen, or Family. Parenting resources should move to a secondary Family area or be retired if usage is weak.
5. **Move New playdate into context.** Show it when the user is viewing a playground, viewing Playdates in Discover, or opening a relevant empty state. Remove the persistent global button from every screen.
6. **Simplify onboarding.** Require parent identity, child nickname, age, interests, and approximate location. Defer availability, radius, visibility detail, and phone verification until the user creates or joins a playdate.

## Target information architecture

### Today

First viewport:

1. Upcoming plans: saved story times, weekend events, hosted or joined playdates.
2. When there are no plans: one personalized nearby suggestion with a direct action.
3. Three intent shortcuts: Go somewhere, Meet playmates, Play at home.

Below the fold:

- One nearby recommendation.
- One suggested way to prepare or extend the experience.
- Optional weather context when it changes the recommendation.

### Discover

Controls:

- Location summary with Use current location and Input address.
- All, Playgrounds, Playdates, Weekend events, Story times.
- Map/List switch.
- Today/Weekend time filter where it applies.

Results:

- A single shared result model for name, category, distance, time, venue, age range, image, source, and status.
- Selected-result card beside the map on desktop and below the map on mobile.
- Playground action: View details, then create a playdate.
- Playdate action: Join or view; a separate `+ New playdate` starts with the currently selected playground.
- Event/story-time action: Save to plans or mark attending, then offer a preparation story.

### Play Studio

Initial cards:

- New play, same toys.
- A book starring them.
- Little stories, big steps.
- Read in your voice.

Each tool needs a clear lifecycle: input, parent preview, edit or regenerate, save, and reuse. Until a tool is backed by a production service, label it as a preview and keep it behind a feature flag.

Recommended release order:

1. Personalized routine stories.
2. Toy-photo play ideas.
3. Personalized learning-book content and approved page templates.
4. Recorded parent narration.
5. Custom synthetic parent voice only after access, consent, storage, and deletion requirements are resolved.

### Family

- Parent and child profiles with active-child switching.
- Play preferences and search radius.
- Saved and past plans.
- Hosted and joined playdates, each linking to its chat.
- Privacy, visibility, blocked families, and account controls.
- Secondary parenting resources if retained.

## Current-to-target capability map

| Current code area | Target destination | Treatment |
| --- | --- | --- |
| `renderHome` | Today | Recompose around upcoming plans and intent shortcuts; reuse event and playdate data |
| `renderPlay` | Discover | Break the monolithic screen into filters, map/list results, and result detail |
| `renderSocial` chat | Contextual playdate chat | Preserve APIs and chat UI; open from plan and playdate detail routes |
| `renderSocial` parenting resources | Family / Resources | Move behind a secondary entry or remove after validating demand |
| `renderFamilyProfile` | Family | Restyle and reorganize without dropping preferences or safety controls |
| Current welcome flow | Sign-in and onboarding | Keep backend/auth logic; shorten required steps and defer social settings |
| Prototype `tools()` | Play Studio | Replace demo modals with production flows incrementally |
| Prototype session storage | Existing backend and Supabase | Do not carry session-only data into the redesigned product |

## Design findings

### Current design strengths

- Warm, approachable tone suitable for families.
- Clear brand mark and established green palette.
- Consistent use of panels, labels, and status messages.
- Desktop Play screen already understands the value of a map-and-list workspace.

### Current design gaps

- The mobile shell behaves like a compressed desktop dashboard. Navigation sits at the top, content becomes extremely long, and important map functionality falls far below the first viewport.
- Many screens use several large rounded panels with similar visual weight. Primary actions, status information, and secondary content compete instead of forming a clear reading order.
- Orange eyebrow labels, yellow global actions, dark teal buttons, pale green cards, and cream surfaces create too many simultaneous emphasis signals.
- Essential text and controls become small in dense Play cards. Long results are difficult to scan and frequently truncate.
- Empty states explain missing data but do not always give one direct recovery action.
- Home contains operational or internal-feeling content such as generated social-poster status that does not advance the parent's main task.

### Example design strengths

- Clear product language and one dominant task per screen.
- Strong mobile hierarchy with persistent bottom navigation.
- Larger type, comfortable touch targets, and better use of white space.
- Category filters and map/list controls match the way parents search.
- Play Studio gives the new AI features a memorable, coherent home.

### Example design limitations

- It uses sample content and browser-session state rather than account-backed data.
- The map is illustrative and cannot communicate real distance or geographic accuracy.
- The sign-in flow is a demo and omits passwordless-email delivery, account errors, privacy links, and recovery.
- AI tools do not include generation latency, moderation, failed uploads, drafts, history, deletion, or cost controls.
- It does not yet cover multiple children, trust settings, playdate membership states, or chat.
- The fixed mobile navigation can cover content and toast messages unless every screen reserves adequate bottom space.

## Target visual system

Use the prototype as the direction, then formalize it:

- **Primary color:** deep SproutCue green for active navigation and main actions.
- **Canvas:** near-white with white content surfaces; use cream only as a deliberate supporting tone.
- **Accent:** one warm accent for time-sensitive or celebratory information, not for every action.
- **Typography:** Manrope or the existing system font for headings, a highly readable sans serif for body copy; body text at 16px by default and controls at 14px or larger.
- **Spacing:** 8px base scale with 20–24px mobile page gutters and 44px minimum touch targets.
- **Surfaces:** fewer cards, clearer grouping, 16–24px radii depending on hierarchy.
- **Icons:** one consistent outline set instead of mixed emoji, SVG, and text glyphs for navigation.
- **Navigation:** desktop top navigation or compact side rail; fixed mobile bottom navigation with safe-area padding.
- **Motion:** short state transitions for filters, sheets, saving, and map selection; respect reduced-motion settings.

## Implementation plan

### Phase 0 — Baseline and contracts

Goal: protect current behavior before changing the shell.

- Document the state and API contracts used by Home, Play, Chat, and Family.
- Add route-level smoke coverage for login, onboarding, location, discovery, saving an event, creating or joining a playdate, opening chat, and switching children.
- Define a normalized `DiscoverItem` client model so playgrounds, playdates, story times, and events can share cards and selected-result UI without changing server records.
- Establish feature flags for the redesigned shell and each Play Studio tool.

Exit criteria: the current application still passes the primary parent journeys and the new shell can be enabled independently.

### Phase 1 — Design foundation and navigation

Goal: establish the new system without rewriting feature logic.

- Introduce shared design tokens for color, type, spacing, radius, borders, shadows, and focus states.
- Build reusable primitives for page headers, chips, result cards, plan cards, segmented map/list controls, sheets/dialogs, loading skeletons, and toast/status messages.
- Change primary navigation to Today, Discover, Play Studio, Family.
- Add contextual routes for playdate detail and chat.
- Keep legacy views reachable behind the feature flag during migration.

Exit criteria: navigation works on mobile and desktop, supports deep links, and does not lose unread/chat or active-child state.

### Phase 2 — Today

Goal: give parents an immediately useful first screen.

- Merge hosted/joined playdates and saved/attending events into one chronological Plans feed.
- Put upcoming plans first when they exist.
- Add the three intent shortcuts and route them to pre-filtered Discover or Play Studio.
- Replace generated-poster and internal status utilities with parent-facing recommendations.
- Add loading, no-location, no-plan, stale-event, and failed-source states.

Exit criteria: a returning parent can see the next commitment and reach its details or chat in one tap; a new parent can find a nearby activity in one tap.

### Phase 3 — Discover

Goal: preserve real discovery while making it scannable.

- Reuse the current location, weather, playground, story-time, event, and playdate loaders.
- Add location controls at the top of the screen.
- Implement category filters and map/list switching using normalized results.
- Keep one selected item synchronized between map and list.
- Move create-playdate into playground/playdate context.
- Use a mobile bottom sheet for selected details; keep a side panel on desktop.
- Preserve refresh, fallback-source labels, search radius, join states, and live Google Map behavior.

Exit criteria: location, filters, map/list selection, save/attend, create/join playdate, and error recovery work on 320px mobile through desktop.

### Phase 4 — Family and contextual Chat

Goal: retain trust and relationship features without crowding primary navigation.

- Recompose Family into profile, preferences, plans, privacy, and safety sections.
- Preserve active-child switching and multiple-child editing.
- Link each hosted or joined playdate to its existing conversation.
- Present chat as a focused route or sheet with a clear return path to the plan.
- Decide whether parenting resources remain in Family based on usage and strategic fit.

Exit criteria: all current safety and communication behavior remains accessible, and no chat thread becomes orphaned.

### Phase 5 — Play Studio foundation

Goal: create a real product surface rather than four disconnected demos.

- Add tool cards and persistent creation records with child ID, tool type, input summary, status, output, created date, and privacy state.
- Add common input/upload, generation, preview, edit, save, delete, and failure patterns.
- Ship personalized routine stories first using reviewed templates and parent preview.
- Add toy-photo play ideas with image upload, age-appropriate suggestions, and a correction path when the toy is misunderstood.
- Add books through fixed page templates so text, child identity, and image consistency can be reviewed.
- Add direct parent recordings before investigating custom synthetic voices.

Exit criteria: at least one tool completes an account-backed input-to-saved-output journey with moderation, error handling, and deletion.

### Phase 6 — Migration, QA, and release

Goal: remove the old shell only after parity is demonstrated.

- Run responsive visual QA at 320, 390, 768, and desktop widths.
- Test 200% text zoom, keyboard navigation, screen-reader labels, reduced motion, and safe-area behavior.
- Test empty, loading, partial-source, offline, permission-denied, expired-event, cancelled-playdate, blocked-user, and multiple-child states.
- Compare analytics for first useful action, plan saves, playdate creation/joining, return visits, and Play Studio completion.
- Roll out by feature flag; remove legacy routes and CSS after stable adoption.

Exit criteria: feature parity is confirmed, regressions are resolved, and the legacy shell can be removed without data migration loss.

## Suggested component structure

```text
src/
  shell/
    AppShell.js
    PrimaryNav.js
    MobileNav.js
  today/
    TodayScreen.js
    PlansFeed.js
    IntentShortcuts.js
  discover/
    DiscoverScreen.js
    LocationPicker.js
    DiscoverFilters.js
    DiscoverMap.js
    DiscoverList.js
    DiscoverDetail.js
    discover-model.js
  studio/
    PlayStudioScreen.js
    ToolCard.js
    CreationFlow.js
  family/
    FamilyScreen.js
    ChildSwitcher.js
    PrivacySettings.js
  playdates/
    PlaydateDetail.js
    PlaydateForm.js
    PlaydateChat.js
  ui/
    Button.js
    Chip.js
    Dialog.js
    Sheet.js
    Status.js
```

This is a directional structure. It can remain plain JavaScript during the redesign; moving everything to React components is a separate architectural decision and should not be bundled into the visual migration unless maintainability requires it.

## Key risks

- **Scope expansion:** AI creation flows can dominate the redesign. Keep them feature-flagged and ship the shell before all four tools.
- **Data fragmentation:** Today, Family, and Discover must use the same saved-plan source rather than copying event state into separate stores.
- **Navigation regression:** Removing Chat from primary navigation requires reliable contextual links and unread indicators.
- **Location privacy:** Clearly distinguish search location, precise browser coordinates, and what other families can see.
- **Map performance:** Avoid rendering both large map and list views simultaneously on mobile; retain selected state when switching.
- **Prototype overfitting:** Preserve live errors, membership states, multiple children, and account behavior even when they complicate the cleaner mockup.

## Recommended first implementation slice

Build the new shell plus Today and Discover before starting AI generation. This slice reuses the greatest amount of working functionality, proves the new product story, and gives parents an immediate improvement:

1. New Today/Discover/Play Studio/Family navigation.
2. Today plans-first feed using existing saved events and playdates.
3. Discover location controls, category filters, real map/list data, and selected result details.
4. Play Studio landing cards marked as previews, without promising unfinished generation.
5. Existing Family settings and contextual Chat restyled but functionally unchanged.

After that slice is stable, implement routine stories as the first complete Play Studio workflow.
