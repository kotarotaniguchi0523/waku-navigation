'use client';

import { useEffect } from 'react';
import { Link, useRouter } from 'waku-navigation';

declare global {
  interface Window {
    __router?: ReturnType<typeof useRouter>;
  }
}

export function Links() {
  const router = useRouter();
  useEffect(() => {
    window.__router = router;
  });
  return (
    <nav>
      <Link to="/about" data-testid="internal" unstable_prefetchOnEnter>
        about
      </Link>{' '}
      <Link
        to={'//example.com/page' as never}
        data-testid="protocol-relative"
        unstable_prefetchOnEnter
      >
        protocol-relative
      </Link>{' '}
      <Link
        to={'https://example.com/page' as never}
        data-testid="absolute"
        unstable_prefetchOnEnter
      >
        absolute
      </Link>{' '}
      {/* Same origin, but outside this app's base path. */}
      <a href="/outside" data-testid="outside">
        outside
      </a>
      <span data-testid="route">{router.path}</span>
    </nav>
  );
}
