import Link from 'next/link';
import { headers } from 'next/headers';

async function loadPlayDate(id) {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host') || '127.0.0.1:3000';
  const protocol = headerStore.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
  const response = await fetch(`${baseUrl}/api/playdates/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!response.ok) return null;
  return (await response.json()).playDate || null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const playDate = await loadPlayDate(id);
  return {
    title: playDate ? `A playdate at ${playDate.playgroundName} · SproutCue` : 'Find your next playdate · SproutCue',
    description: playDate
      ? `A nearby family is making plans at ${playDate.playgroundName}. Join them on SproutCue.`
      : 'Meet nearby families and make a simple plan on SproutCue.',
  };
}

function formatDate(value) {
  return new Date(value).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function metrics(playDate) {
  const count = Number(playDate.participantCount) || 0;
  const spots = playDate.maxFamilies ? Math.max(playDate.maxFamilies - count, 0) : null;
  return [
    { value: count || '—', label: count === 1 ? 'family already in' : 'families already in', tone: 'green' },
    { value: spots === null ? 'Open' : spots, label: spots === 1 ? 'spot left' : spots === null ? 'open invite' : 'spots left', tone: 'orange' },
    { value: playDate.ageRange ? 'Good fit' : 'All ages', label: playDate.ageRange || 'family-friendly', tone: 'purple' },
  ];
}

export default async function SharePlayDatePage({ params }) {
  const { id } = await params;
  const playDate = await loadPlayDate(id);

  if (!playDate) {
    return <main className="share-page share-page-empty"><section className="share-card"><p className="share-brand"><img src="/favicon.svg" alt="" /> SproutCue</p><p className="eyebrow">The invite has moved on</p><h1>This playdate is no longer available.</h1><p>Browse the neighborhood and find another easy way to meet nearby families.</p><Link className="primary-link" href="/">Explore SproutCue</Link></section></main>;
  }

  const stats = metrics(playDate);
  const ctaUrl = `/?playdate=${encodeURIComponent(id)}`;
  return <main className="share-page share-page-redesign">
    <div className="share-page-glow share-page-glow-one" />
    <div className="share-page-glow share-page-glow-two" />
    <section className="share-shell">
      <header className="share-header"><Link href="/" className="share-brand"><img src="/favicon.svg" alt="" /> SproutCue</Link><span className="share-header-note">A little closer to home</span></header>
      <div className="share-layout">
        <section className="share-hero">
          <div className="share-hero-copy">
            <p className="eyebrow">A nearby family made a plan</p>
            <h1>Your kid’s next friend could be closer than you think.</h1>
            <p className="share-lede">Say hello at the playground, keep it low-key, and let the kids do what they do best: play.</p>
            <div className="share-location-pill"><span className="share-location-dot" /> {playDate.playgroundName}</div>
          </div>
          <img className="share-hero-art" src="/illustrations/playdates.png" alt="Families meeting at a neighborhood playground" />
        </section>
        <section className="share-card share-invite-card">
          <div className="share-invite-top"><span className="share-live-dot" /> Public playdate invite <span className="share-invite-capacity">{playDate.participantCount || 0} in</span></div>
          <h2>Meet at {playDate.playgroundName}</h2>
          <div className="share-date-row"><div className="share-date-icon">✦</div><div><strong>{formatDate(playDate.startsAt)}</strong><span>{formatTime(playDate.startsAt)}–{formatTime(playDate.endsAt)}</span></div></div>
          {playDate.notes ? <p className="share-notes">“{playDate.notes}”</p> : null}
          <Link className="primary-link share-cta" href={ctaUrl} data-growth-event="share_preview_join">Join this playdate <span>→</span></Link>
          <p className="share-reassurance">Free to join · Keep your family details private</p>
        </section>
      </div>
      <section className="share-proof" aria-label="Playdate details">
        <div className="share-proof-heading"><p className="eyebrow">The good kind of social</p><h2>Small steps. Real connections.</h2><p>Everything you need to decide if this feels like your kind of afternoon.</p></div>
        <div className="share-metrics">{stats.map((stat) => <div className={`share-metric ${stat.tone}`} key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
      </section>
      <footer className="share-footer"><span>SproutCue helps families find their people, one playground at a time.</span><Link href="/">Learn about SproutCue <span>→</span></Link></footer>
    </section>
  </main>;
}
