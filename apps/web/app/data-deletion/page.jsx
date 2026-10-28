import { CHAT_RETENTION_LABEL, LEGAL_ENTITY } from '@sproutcue/shared/legal';
import { SUPPORT_EMAIL } from '@sproutcue/shared/terms';
import Link from 'next/link';

export const metadata = {
  title: 'Delete Your Data | SproutCue',
  description: 'How to delete a SproutCue account and family data, what is deleted, and what is kept.',
};

// Google Play's Data safety form links here: it must name the app and developer, give the
// steps, and say what is deleted and what is kept, for how long. Keep in step with
// apps/web/lib/account-deletion.js and the Privacy Policy.
export default function DataDeletionPage() {
  return (
    <main className="app-shell privacy-shell">
      <article className="panel privacy-panel data-deletion-page">
        <p className="eyebrow">SproutCue account controls</p>
        <h1>Delete your SproutCue data</h1>
        <p className="muted">SproutCue is made by {LEGAL_ENTITY}. Parents can permanently delete their SproutCue account and family data at any time, in the app or on the web.</p>

        <h2>In the SproutCue app (iPhone or Android)</h2>
        <ol className="data-deletion-steps">
          <li>Open the <strong>Family</strong> tab.</li>
          <li>Tap your account picture at the top to open the account menu.</li>
          <li>Tap <strong>Delete account</strong> below <strong>Sign out</strong>, and confirm.</li>
        </ol>

        <h2>On the web</h2>
        <ol className="data-deletion-steps">
          <li><Link href="/">Sign in to SproutCue</Link>.</li>
          <li>Open the <strong>Family</strong> tab.</li>
          <li>Choose <strong>Delete account</strong> beside <strong>Edit family details</strong>.</li>
          <li>Type <strong>DELETE</strong> to confirm.</li>
        </ol>

        <p>Can’t sign in? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20SproutCue%20account`}>{SUPPORT_EMAIL}</a> from the email address on your account and we’ll delete it for you.</p>

        <h2>What is deleted right away</h2>
        <p>Your sign-in and parent profile, child profiles, saved locations, family plans and saved events, playdates you host, the chat messages, photos, and videos you sent, your photo library, AI creations (picture books, stories, play ideas) and their photo-check results, notifications, push notification tokens, and any safety reports you filed.</p>
        <p>To delete only some things, you can remove individual photos and AI creations in the app, and turn off AI features in your account settings, without deleting your account.</p>

        <h2>What is kept, and for how long</h2>
        <ul>
          <li><strong>Reports other families filed about your messages</strong>, including a copy of the reported message, are kept for {CHAT_RETENTION_LABEL} after they were filed so our safety team can act on them, then deleted automatically.</li>
          <li><strong>Backups:</strong> deleted information may remain in encrypted backups for a limited time until those backups expire.</li>
          <li><strong>AI provider:</strong> photos and details sent for an AI creation may be kept by OpenAI for up to 30 days for abuse monitoring, then deleted.</li>
          <li>Information we must keep to meet a legal obligation is kept only as long as required.</li>
        </ul>
        <p>Deleting your account can’t be undone. See the <Link href="/privacy">Privacy Policy</Link> for details.</p>

        <p className="data-deletion-actions"><Link className="primary-link" href="/">Return to SproutCue</Link><Link className="secondary-button" href="/privacy">View Privacy Policy</Link></p>
      </article>
    </main>
  );
}
