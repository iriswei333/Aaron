import { SAFETY_EMAIL, SUPPORT_EMAIL, TERMS_VERSION } from '@sproutcue/shared/terms';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Use | SproutCue',
  description: 'SproutCue Terms of Use, including community rules for chat and playdates.',
};

// Draft for review — have a lawyer check it before launch. Placeholders are in [brackets].
// When this text changes in a way families must re-accept, bump TERMS_VERSION
// (packages/shared/src/terms.js) and the profiles.terms_version default.
export default function TermsPage() {
  return (
    <main className="app-shell privacy-shell">
      <article className="panel privacy-panel">
        <p className="eyebrow">SproutCue terms</p>
        <h1>Terms of Use</h1>
        <p className="muted">Draft for review. Version {TERMS_VERSION}. Effective date: [Month Day, Year].</p>

        <p>These Terms of Use are an agreement between you and [SproutCue legal entity name] (“SproutCue”, “we”) for the SproutCue website at app.sproutcue.com and the SproutCue apps for iPhone and Android. By creating an account or continuing to use SproutCue, you agree to these terms and acknowledge our <Link href="/privacy">Privacy Policy</Link>. If you don’t agree, please don’t use SproutCue.</p>

        <h2>1. Who can use SproutCue</h2>
        <p>SproutCue is for parents and caregivers who are at least 18 years old. Children may not create accounts, use chat, or create playdates. You may only add information about children you are a parent or legal guardian of, or are otherwise authorized to share.</p>

        <h2>2. Your account</h2>
        <p>Keep your sign-in details secure and give accurate information about yourself. You are responsible for activity on your account. One account per family; don’t share, sell, or transfer it, and don’t pretend to be someone else.</p>

        <h2>3. Community rules — zero tolerance</h2>
        <p><strong>SproutCue has zero tolerance for objectionable content and abusive users.</strong> In chat, playdates, photos, and anything else you share, you must not post or send:</p>
        <ul>
          <li>Harassment, bullying, threats, or intimidation of any person</li>
          <li>Hate speech or content that attacks people for who they are</li>
          <li>Sexual or sexually suggestive content of any kind, and anything that sexualizes, endangers, or exploits a child</li>
          <li>Violent, graphic, or self-harm content</li>
          <li>Spam, scams, advertising, or requests for money</li>
          <li>Photos or personal details of another family or their children without their permission</li>
          <li>Anything illegal, or anything that encourages illegal or dangerous activity</li>
        </ul>
        <p>We may remove content and suspend or permanently remove any account that breaks these rules, without notice. Content that may involve the exploitation of a child is reported to the National Center for Missing &amp; Exploited Children and to law enforcement.</p>

        <h2>4. Reporting and blocking</h2>
        <p>You can report any chat message by long-pressing it in the app (or using Report on the web), and block a family from a chat. Blocked families can’t message you directly, and you won’t see their messages. Our team reviews reports and acts on content that breaks these terms. You can also email safety concerns to <a href={`mailto:${SAFETY_EMAIL}`}>{SAFETY_EMAIL}</a>. If anyone is in immediate danger, call 911 or your local emergency number first.</p>

        <h2>5. Meeting other families</h2>
        <p>SproutCue helps families find each other and plan playdates, but we don’t screen or verify users and aren’t responsible for how people behave online or in person. Use your judgment: meet in public places, keep your children supervised at all times, and don’t share your home address or other private details until you’re comfortable.</p>

        <h2>6. Your content</h2>
        <p>You keep ownership of the photos, messages, and other content you add. You give SproutCue a limited license to store, process, and display that content only to run the service for you and the families you share it with. You are responsible for having the right to share what you post.</p>

        <h2>7. AI features</h2>
        <p>Picture books, stories, play ideas, and other AI-generated content may be inaccurate or unsuitable. Review it before using it with your child, and always supervise play. Don’t upload photos of other people’s children for AI features without their parent’s permission.</p>

        <h2>8. Places, events, and other services</h2>
        <p>Event, place, weather, and resource information comes from third parties and may be out of date. Check details with the organizer or venue. Links to other sites are provided for convenience and are governed by those sites’ own terms.</p>

        <h2>9. Ending your account</h2>
        <p>You can delete your account at any time from the account menu; see <Link href="/data-deletion">data deletion</Link>. We may suspend or end access if you break these terms or to protect other families. Reports about your conduct may be kept after your account is deleted, as described in the Privacy Policy.</p>

        <h2>10. Disclaimers and limits</h2>
        <p>SproutCue is provided “as is” without warranties of any kind, to the extent allowed by law. To the extent allowed by law, SproutCue is not liable for indirect, incidental, or consequential damages, or for the conduct of any user online or offline. [Liability cap, governing law ([State]), and dispute terms to be confirmed with counsel.]</p>

        <h2>11. Changes</h2>
        <p>We may update these terms. If a change is significant, we’ll tell you in the app and may ask you to accept the new terms before you continue using SproutCue.</p>

        <h2>12. Contact</h2>
        <p>Questions about SproutCue or your account: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
        <p>Safety concerns and reports: <a href={`mailto:${SAFETY_EMAIL}`}>{SAFETY_EMAIL}</a></p>
        <p>Mail: [full mailing address]</p>
        <p><Link href="/">Return to SproutCue</Link></p>
      </article>
    </main>
  );
}
