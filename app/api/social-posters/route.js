import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getCurrentProfile, profileErrorResponse } from '../../../lib/profile-session.js';
import { familyEventCityForUser } from '../../../lib/family-events.js';

export const runtime = 'nodejs';

const POSTER_DIR = resolve('output/social-posts');
const MIME_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function citySlug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function GET(request) {
  try {
    const current = await getCurrentProfile(request);
    if (!current.user) return profileErrorResponse(current);
    const file = new URL(request.url).searchParams.get('file') || '';
    if (file) {
      const safeName = file.split('/').pop();
      const path = resolve(POSTER_DIR, safeName);
      if (path !== join(POSTER_DIR, safeName) || !MIME_TYPES[safeName.slice(safeName.lastIndexOf('.')).toLowerCase()]) {
        return Response.json({ error: 'Invalid poster file.' }, { status: 400 });
      }
      const data = await readFile(path);
      return new Response(data, {
        headers: {
          'cache-control': 'no-cache',
          'content-type': MIME_TYPES[safeName.slice(safeName.lastIndexOf('.')).toLowerCase()],
        },
      });
    }
    let names = [];
    try { names = await readdir(POSTER_DIR); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const posters = await Promise.all(names
      .filter((name) => MIME_TYPES[name.slice(name.lastIndexOf('.')).toLowerCase()])
      .map(async (name) => ({
        name,
        url: `/api/social-posters?file=${encodeURIComponent(name)}`,
        modifiedAt: (await stat(resolve(POSTER_DIR, name))).mtime.toISOString(),
      })));
    posters.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    const locationCity = familyEventCityForUser(current.user);
    const prefix = `${citySlug(locationCity)}-`;
    const recommendedPoster = locationCity
      ? posters.find((poster) => poster.name.toLowerCase().startsWith(prefix)) || null
      : null;
    return Response.json({ posters, recommendedPoster, locationCity, directory: POSTER_DIR, authMode: current.mode });
  } catch (error) {
    if (error.code === 'ENOENT') return Response.json({ error: 'Poster not found.' }, { status: 404 });
    return Response.json({ error: error.message }, { status: 500 });
  }
}
