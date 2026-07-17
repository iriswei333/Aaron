import { updateSupabaseSession } from './lib/supabase/middleware.js';

export async function middleware(request) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
