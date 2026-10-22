// Android App Links: lets com.sproutcue.app verify it may open app.sproutcue.com links.
// Which paths open in the app is set by the intent filter in apps/mobile/app.json (/share).
export const dynamic = 'force-static';

export function GET() {
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.sproutcue.app',
        sha256_cert_fingerprints: [
          // EAS production keystore
          '39:7A:78:89:B7:4C:E5:5F:D0:83:EE:CE:17:EA:BE:0B:D5:33:F4:89:68:63:A7:78:DE:15:8C:D2:78:83:BB:96',
          // TODO: add the Google Play "App signing key" SHA-256 once the app is on Google Play
        ],
      },
    },
  ]);
}
