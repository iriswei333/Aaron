import { NextResponse } from 'next/server';
import { corsHeadersFor } from './lib/cors.js';
import { updateSupabaseSession } from './lib/supabase/middleware.js';

export async function middleware(request) {
  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const cors = isApi ? corsHeadersFor(request.headers.get('origin')) : null;

  if (isApi && request.method === 'OPTIONS') {
    return new NextResponse(null, { status: cors ? 204 : 403, headers: cors || {} });
  }

  const response = await updateSupabaseSession(request);
  if (cors) Object.entries(cors).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
