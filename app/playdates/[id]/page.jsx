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
    title: playDate ? `Playdate at ${playDate.playgroundName} · SproutCue` : 'Public playdate · SproutCue',
    description: playDate ? `Join a family playdate at ${playDate.playgroundName}.` : 'Find and join family playdates on SproutCue.',
  };
}

function formatWindow(playDate) {
  const start = new Date(playDate.startsAt);
  const end = new Date(playDate.endsAt);
  const date = start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const time = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return `${date} · ${time}`;
}

export default async function PublicPlayDatePage({ params }) {
  const { id } = await params;
  const playDate = await loadPlayDate(id);
  if (!playDate) {
    return <main className="share-page"><section className="share-card"><p className="eyebrow">SproutCue</p><h1>Playdate unavailable</h1><p>This public playdate may have ended, been cancelled, or reached a private state.</p><Link className="primary-link" href="/">Open SproutCue</Link></section></main>;
  }
  return <main className="share-page"><section className="share-card"><p className="eyebrow">Public playdate invitation</p><h1>Join a playdate at {playDate.playgroundName}</h1><p className="share-detail">{formatWindow(playDate)}</p><p className="share-detail">{playDate.participantCount || 0}{playDate.maxFamilies ? ` of ${playDate.maxFamilies}` : ''} families joined</p>{playDate.ageRange ? <p>{playDate.ageRange}</p> : null}{playDate.notes ? <p className="share-notes">{playDate.notes}</p> : null}<Link className="primary-link" href={`/?playdate=${encodeURIComponent(id)}`}>Open SproutCue to join</Link><p className="muted">Create a free family profile to join public playdates and stay updated.</p></section></main>;
}
