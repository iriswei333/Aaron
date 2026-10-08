'use client';

import { useEffect } from 'react';

// The client-rendered planner owns the tab UI. This catch-all route ensures
// bookmarked tab URLs such as /play or /family also reach the planner on a
// fresh request instead of returning a Next.js 404.
export default function PlannerTabPage() {
  useEffect(() => {
    import('../../src/main.js');
  }, []);

  return <div id="root" />;
}
