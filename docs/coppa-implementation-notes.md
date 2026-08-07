# COPPA implementation notes for SproutCue

These notes are based on the current repository and should be completed before the policy is published.

## Product classification assumption

SproutCue is intended to be a parent-only service: an adult creates and controls the account, and children do not submit information or participate directly. The FTC states that COPPA generally concerns personal information collected online from children, and distinguishes information collected online from parents. Counsel should confirm the classification against the actual user experience, marketing, audience, and any future features. Keep the child-privacy safeguards below even if the final legal analysis concludes that COPPA’s direct-consent trigger is not met.

## Highest-priority gaps

1. Document the parent-only product decision: adult-only account terms, age screen, parent-facing marketing, and controls preventing child account creation or direct participation.
2. Decide with counsel whether a formal COPPA verifiable-consent gate is legally required when the parent—not the child—enters the child profile. Regardless, obtain explicit authorization before optional public sharing, chat, or location processing where appropriate. A checkbox alone is not verifiable parental consent.
3. Keep consent for internal personalization separate from consent for public play dates, parent-to-parent chat, and location sharing.
4. Add a parent workflow to review, correct, download if appropriate, delete, and stop further collection/use of a child’s information; verify the requester without making the process unduly burdensome.
5. Create and enforce retention/deletion jobs for profiles, play dates, chat/media, consent records, logs, caches, and backups. The current code has no documented COPPA deletion schedule.
6. Inventory and name every production operator. The code references Supabase, Open-Meteo, Google Places, and event/resource sources; confirm the actual providers, contracts, regions, and retention settings.
7. Review public play-date fields and chat profile visibility. The app currently supports public playground, address/coordinate, date/time, notes, age-range, host-label, and participant information.
8. Confirm whether child images/videos ever leave the browser. Local caption drafting should remain browser-local; chat media is sent to the backend when the parent explicitly shares it.
9. Add a prominent privacy-policy link on the home page and at every child-information collection point, plus a direct-notice record for each consent request.
10. Write and maintain the required information-security and service-provider oversight program.

## FTC checkpoints covered by the drafts

- clear, comprehensive privacy-policy contents;
- direct notice before collection and upon material changes;
- verifiable parental consent;
- separate choice for non-integral third-party disclosures;
- parental review, deletion, and consent withdrawal;
- reasonable security procedures; and
- purpose-based retention and deletion.

## Product recommendation

Until the consent and deletion flows exist, keep child-profile creation, public play dates, and chat behind a controlled beta or restrict them to adults who have completed the documented authorization process. Do not describe the app as “COPPA compliant” based only on these drafts.
