// Rewrites incoming links before Expo Router matches them.
//
// Screens take descriptive query params (e.g. /playdate/details?playDateId=…) instead of
// bracketed [id] route files, so older playdate links — sproutcue://playdate/<id>, /playdate/<id>,
// or a web share link ending in /playdate/<id> — are pointed at the details screen here.
// Every other link (auth callback, etc.) passes through unchanged.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const match = /(?:^|[/:])playdate\/([^/?#]+)/i.exec(path);
    if (match && match[1] !== 'details') {
      return `/playdate/details?playDateId=${encodeURIComponent(decodeURIComponent(match[1]))}`;
    }
  } catch {
    // Malformed link: leave it as it came in.
  }
  return path;
}
