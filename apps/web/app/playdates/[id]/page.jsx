import { redirect } from 'next/navigation';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return {
    title: 'Find your next playdate · SproutCue',
    description: 'Meet nearby families and make a simple plan on SproutCue.',
  };
}

export default async function PublicPlayDatePage({ params }) {
  const { id } = await params;
  redirect(`/share/playdate/${encodeURIComponent(id)}`);
}
