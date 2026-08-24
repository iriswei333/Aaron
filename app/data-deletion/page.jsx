import Link from 'next/link';

export const metadata = {
  title: 'Delete Your Data | SproutCue',
  description: 'Instructions for deleting a SproutCue parent account and associated family data.',
};

export default function DataDeletionPage() {
  return (
    <main className="app-shell privacy-shell">
      <article className="panel privacy-panel data-deletion-page">
        <p className="eyebrow">SproutCue account controls</p>
        <h1>Delete your data</h1>
        <p className="muted">Parents can permanently delete their SproutCue account and associated family data at any time.</p>

        <h2>How to delete your account</h2>
        <ol className="data-deletion-steps">
          <li><Link href="/">Sign in to SproutCue</Link> using your account.</li>
          <li>Open the <strong>Family</strong> tab.</li>
          <li>Select <strong>Edit profile</strong>.</li>
          <li>Choose <strong>Delete parent data</strong>.</li>
          <li>Type <strong>DELETE</strong> to confirm.</li>
        </ol>

        <h2>What will be deleted</h2>
        <p>Deletion permanently removes your parent profile, child profiles, saved locations, family plans, playdates, chat messages and media, saved events, and associated local account data.</p>

        <h2>Important</h2>
        <p>This action cannot be undone. Public links or cached third-party content may remain temporarily outside SproutCue’s systems, but your SproutCue account records are deleted through the account deletion process.</p>

        <p className="data-deletion-actions"><Link className="primary-link" href="/">Return to SproutCue</Link><Link className="secondary-button" href="/privacy">View Privacy Policy</Link></p>
      </article>
    </main>
  );
}
