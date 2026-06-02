import '../src/styles.css';

export const metadata = {
  title: 'Aaron Daily Life Planner',
  description: 'Family daily planner with social captions, errands, food, and play planning.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
