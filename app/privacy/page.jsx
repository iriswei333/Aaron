import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | SproutCue',
  description: 'SproutCue privacy policy for parent accounts and child-related information.',
};

export default function PrivacyPage() {
  return (
    <main className="app-shell privacy-shell">
      <article className="panel privacy-panel">
        <p className="eyebrow">SproutCue privacy</p>
        <h1>Privacy Policy</h1>
        <p className="muted">Draft for review. Effective date: [Month Day, Year].</p>

        <h2>Adult-only service</h2>
        <p>SproutCue is a planning service for parents and caregivers. Only adults may create and manage accounts. Children may not create accounts, submit information, use chat, or create play dates.</p>

        <h2>Information we collect</h2>
        <p>We collect parent account information, child-profile information entered by a parent, saved locations, saved weekend-event decisions, play-date details, parent-to-parent messages and media, and browser-local settings needed to provide the service.</p>

        <h2>How we use information</h2>
        <p>We use information to authenticate parent accounts, personalize play activities, find nearby places and events, manage play dates, enable parent-to-parent chat, and maintain and secure SproutCue. We do not use children’s information for behavioral advertising or sell it.</p>

        <h2>Sharing</h2>
        <p>We use service providers for authentication, hosting, storage, maps, weather, events, and resources. Public play dates may show the selected play-date details to authenticated users who can view them. Chat messages and media are available to the intended participants.</p>

        <h2>Parent choices</h2>
        <p>Parents may review, correct, delete, or request that we stop using information about their children by using the account deletion control or following the <Link href="/data-deletion">data deletion instructions</Link>. Public play dates, chat, and location features are optional.</p>

        <h2>Retention and security</h2>
        <p>We retain information only as long as reasonably necessary for the purpose collected, legal obligations, security, or dispute resolution. We use reasonable safeguards appropriate to the sensitivity of the information and securely delete data when the retention period ends.</p>

        <h2>Contact</h2>
        <p>Privacy questions and requests: [privacy email] · [full mailing address]</p>
        <p><Link href="/">Return to SproutCue</Link></p>
      </article>
    </main>
  );
}
