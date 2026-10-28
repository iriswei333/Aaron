import { AI_PROVIDER_NAME } from '@sproutcue/shared/ai-consent';
import { CHAT_RETENTION_LABEL, LEGAL_ADDRESS, LEGAL_ENTITY, PRIVACY_EFFECTIVE_DATE } from '@sproutcue/shared/legal';
import { SAFETY_EMAIL, SUPPORT_EMAIL } from '@sproutcue/shared/terms';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | SproutCue',
  description: 'How SproutCue collects, uses, shares, and deletes information about parents and the children they add.',
};

// Keep this page in step with the code it describes:
//   AI processing + consent  → packages/shared/src/ai-consent.js, apps/web/lib/ai-consent.js
//   chat retention           → supabase/migrations/202610280002_chat_retention.sql
//   account deletion         → apps/web/lib/account-deletion.js and app/data-deletion
export default function PrivacyPage() {
  return (
    <main className="app-shell privacy-shell">
      <article className="panel privacy-panel">
        <p className="eyebrow">SproutCue privacy</p>
        <h1>Privacy Policy</h1>
        <p className="muted">Effective {PRIVACY_EFFECTIVE_DATE}</p>

        <p>SproutCue helps parents and caregivers plan play, find places and playdates nearby, talk with other families, and make picture books, stories, and play ideas for their child. SproutCue is operated by {LEGAL_ENTITY} (“SproutCue”, “we”, “us”). This policy covers the website at app.sproutcue.com and the SproutCue apps for iPhone and Android.</p>

        <h2>1. A service for parents, not children</h2>
        <p>Only adults 18 or older may create a SproutCue account. Children do not use SproutCue: they can’t create accounts, sign in, chat, or create playdates. A parent or caregiver enters any information about their child and controls it.</p>
        <p>We do not knowingly collect personal information directly from a child under 13. If you believe a child has given us information, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will delete it. We treat the child information parents add with extra care: we never sell it, use it for advertising, or make it publicly searchable.</p>

        <h2>2. Information we collect</h2>
        <p><strong>Your account.</strong> Your email address and the name you choose. If you sign in with Apple or Google, we receive your name and email (or Apple’s private relay address) from them. If you use a password, it is stored only as a secure hash. We record when you accepted the Terms of Use.</p>
        <p><strong>Your child’s profile.</strong> What you choose to add: your child’s name or nickname, birthday or age, home city, favorite activities, the skills you’re practicing together, and story and caption language.</p>
        <p><strong>Photos.</strong> Photos you choose for Play Studio (picture books, practice stories, toy play) are stored privately in your family’s photo library. Before a photo is used for a picture book or story, an automated check confirms it shows one young child. We keep only the check’s result with the photo: the number of people, an approximate age range, whether a face is visible, and how confident the check was. The check does not recognize or identify anyone, and we do not create or keep face templates or other biometric identifiers. A photo that fails the check is deleted right away and never saved.</p>
        <p><strong>AI creations.</strong> The picture books, stories, and play ideas you make, and the choices you made for them.</p>
        <p><strong>Location.</strong> A city or address you type in, or, if you allow it, your device’s location while you are using the app. We use it to show playgrounds, playdates, events, weather, and story times near you, and save the location you choose to your profile. You can deny or turn off location access in your device settings and type a location instead.</p>
        <p><strong>Playdates.</strong> The playground, address, date and time, notes, age range, and who has joined.</p>
        <p><strong>Chat.</strong> Messages, photos, and short videos you send to other families, the chats you’re in, families you block, and reports you file about messages.</p>
        <p><strong>Device and technical information.</strong> A push notification token for your device, so we can tell you when a creation is ready; sign-in cookies and session data; settings saved in your browser; and basic request and error logs kept by our hosting provider to run and secure the service. SproutCue does not use advertising identifiers, ad networks, or third-party analytics trackers.</p>

        <h2>3. How we use information</h2>
        <ul>
          <li>To run your account and the features you use: play ideas, nearby places and events, playdates, chat, and Play Studio creations.</li>
          <li>To send you notices you expect, such as sign-in codes and “your creation is ready” notifications.</li>
          <li>To keep families safe: reviewing reports, enforcing the <Link href="/terms">Terms of Use</Link>, and preventing abuse.</li>
          <li>To maintain, secure, and fix SproutCue, and to meet legal obligations.</li>
        </ul>
        <p>We do not sell personal information, share it for targeted advertising, or use your child’s information to build advertising profiles.</p>

        <h2>4. AI features and {AI_PROVIDER_NAME}</h2>
        <p>Picture books, practice stories, toy play ideas, and playground stories are made with {AI_PROVIDER_NAME}, a third-party AI service. <strong>We ask your permission before any AI feature is used,</strong> and nothing is sent to {AI_PROVIDER_NAME} until you choose “Allow AI features.”</p>
        <p>When you make a creation, we send {AI_PROVIDER_NAME} only what that creation needs:</p>
        <ul>
          <li>the photos you chose for it (your child or a toy), including for the photo check described above; and</li>
          <li>your child’s name or nickname, age, and the goals, interests, and story choices you picked.</li>
        </ul>
        <p>We never send {AI_PROVIDER_NAME} your location, chat messages, or email address. {AI_PROVIDER_NAME} processes this data for us as a service provider. It does not use data sent through its API to train its models, and may keep it for up to 30 days to monitor for abuse before deleting it.</p>
        <p>You can turn AI features off at any time on the Family tab (web) or in the account menu on the Family tab (app). New creations then stop, and any creation that hasn’t started is cancelled. Creations you already made stay until you delete them. AI-generated content can be inaccurate; review it before sharing it with your child.</p>

        <h2>5. What other families can see</h2>
        <p><strong>Public playdates</strong> show the playground, address and map location, date and time, age range, notes, your display name as host, and how many families have joined, to signed-in SproutCue families. <strong>Private playdates</strong> are visible only to you and the families who join.</p>
        <p><strong>Chat</strong> messages, photos, and videos are visible to the members of that chat, along with your display name. Please don’t share your child’s full name, home address, school, or health details in chat or in playdate notes.</p>

        <h2>6. Who we share information with</h2>
        <p>We share information only as described here. Our service providers may use it only to provide their service to us:</p>
        <ul>
          <li><strong>Supabase</strong>: accounts, sign-in, database, and private file storage.</li>
          <li><strong>Vercel</strong>: website and app server hosting.</li>
          <li><strong>{AI_PROVIDER_NAME}</strong>: AI features, only after you allow them (see section 4).</li>
          <li><strong>Google</strong>: Google sign-in if you use it; Google Maps and Places to find playgrounds and places near the location you search.</li>
          <li><strong>Apple</strong>: Sign in with Apple if you use it, and notification delivery to iPhones.</li>
          <li><strong>Expo and Google Firebase Cloud Messaging</strong>: delivering push notifications to your devices.</li>
          <li><strong>Open-Meteo</strong>: weather for the area you’re looking at.</li>
          <li><strong>Resend</strong>: sending SproutCue’s emails.</li>
        </ul>
        <p>We may also disclose information when required by law or valid legal process; to protect the safety of a child or anyone else (content that may involve the exploitation of a child is reported to the National Center for Missing &amp; Exploited Children and to law enforcement); to enforce our terms; or as part of a merger, acquisition, or sale of assets, in which case this policy continues to apply to your information.</p>

        <h2>7. How long we keep information</h2>
        <ul>
          <li><strong>Account, child profile, location, playdates, and saved plans:</strong> until you delete them or delete your account.</li>
          <li><strong>Photos and AI creations:</strong> until you delete them or delete your account. We don’t delete them on a schedule.</li>
          <li><strong>Photo check results:</strong> kept with your account to help us keep the check accurate, and deleted when you delete your account. They never include the photo.</li>
          <li><strong>Chat messages, photos, and videos:</strong> deleted automatically {CHAT_RETENTION_LABEL} after they are sent. Deleting your account deletes the messages you sent sooner.</li>
          <li><strong>Safety reports</strong> (including a copy of the reported message): deleted automatically {CHAT_RETENTION_LABEL} after the report is filed. A report about a family is kept for that year even if that family deletes their account, so we can act on it. Reports you filed are deleted with your account.</li>
          <li><strong>Push notification tokens:</strong> until you sign out on that device or delete your account.</li>
          <li><strong>Data sent to {AI_PROVIDER_NAME}:</strong> up to 30 days on {AI_PROVIDER_NAME}’s side, as described in section 4.</li>
        </ul>
        <p>Deleted information may remain in encrypted backups for a limited time until those backups expire.</p>

        <h2>8. Your choices and rights</h2>
        <ul>
          <li><strong>See and correct:</strong> edit your family and child details at any time under Edit family details.</li>
          <li><strong>Delete:</strong> delete individual photos and creations, or your whole account, in the app. See <Link href="/data-deletion">how to delete your data</Link>.</li>
          <li><strong>AI features:</strong> allow or turn off AI features at any time (section 4).</li>
          <li><strong>Location and notifications:</strong> turn either off in your device settings.</li>
          <li><strong>Chat:</strong> block a family or report a message at any time.</li>
        </ul>
        <p>Parents can also email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on their account to ask for a copy of the information we hold about their family, to correct or delete it, or to stop further use of their child’s information. We may ask you to confirm you own the account. Depending on where you live, you may have additional rights under local law, and we will honor them.</p>

        <h2>9. Security</h2>
        <p>We protect information with encryption in transit, access controls that limit each family to its own data, private storage for photos, and restricted access for our team. No system is perfectly secure; if you think your account has been compromised, contact us right away.</p>

        <h2>10. Where information is processed</h2>
        <p>SproutCue is operated from the United States, and information is processed and stored in the United States by us and our service providers.</p>

        <h2>11. Changes to this policy</h2>
        <p>If we make a material change, especially to how we use or share children’s information or what we send to AI providers, we will tell you in the app before it takes effect and ask for your agreement again where required.</p>

        <h2>12. Contact us</h2>
        <p>{LEGAL_ENTITY}<br />{LEGAL_ADDRESS}</p>
        <p>Privacy questions and requests: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
        <p>Safety concerns: <a href={`mailto:${SAFETY_EMAIL}`}>{SAFETY_EMAIL}</a></p>
        <p>See also our <Link href="/terms">Terms of Use</Link>.</p>
        <p><Link href="/">Return to SproutCue</Link></p>
      </article>
    </main>
  );
}
