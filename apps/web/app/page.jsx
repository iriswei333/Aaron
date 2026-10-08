'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    import('../src/main.js');
  }, []);

  return <div id="root" />;
}
