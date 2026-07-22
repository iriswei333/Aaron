import '../src/styles.css';

export const metadata = {
  title: 'SproutCue',
  description: 'Personalized daily planning for parents of young kids.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
