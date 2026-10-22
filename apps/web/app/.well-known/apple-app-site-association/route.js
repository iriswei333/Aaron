// iOS universal links: tells iOS which app.sproutcue.com paths open in the SproutCue app.
// Only /share/* is claimed, so the rest of the web app still opens in the browser.
// Must be served as JSON at this exact path with no redirect.
export const dynamic = 'force-static';

export function GET() {
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: ['GXTP2VR94N.com.sproutcue.app'],
          components: [{ '/': '/share/*', comment: 'Shared playdates and future share links' }],
        },
      ],
    },
  });
}
