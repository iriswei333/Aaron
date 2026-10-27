// Unknown /api/* addresses answer with a JSON 404. Without this, the planner's
// catch-all page (app/[...slug]) would answer them with HTML and a 200, which
// clients could mistake for success. Real routes are more specific and win.

function notFound(request) {
  const { pathname } = new URL(request.url);
  return Response.json({ error: `No API route at ${pathname}.` }, { status: 404 });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
