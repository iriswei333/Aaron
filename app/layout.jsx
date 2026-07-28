import '../src/styles.css';

export const metadata = {
  title: 'SproutCue',
  description: 'Personalized daily planning for parents of young kids.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head><script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async /></head>
      <body>{children}</body>
    </html>
  );
}
