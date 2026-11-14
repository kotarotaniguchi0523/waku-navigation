'use client';

import { startTransition, useEffect, useLayoutEffect, useState } from 'react';
import { useRouter } from 'waku-navigation';

type Router = ReturnType<typeof useRouter>;
type Method = 'push' | 'replace' | 'reload';

declare global {
  interface Window {
    __router?: Router;
    __inTransition?: (method: Method, to?: string) => Promise<string>;
    // Each DOM commit of the layout: the route React shows and the URL then.
    __commits?: { route: string; url: string }[];
    // Fails the layout's next render, which unmounts the router.
    __crash?: () => void;
  }
}

export function Nav() {
  const router = useRouter();
  const [crashed, setCrashed] = useState(false);
  if (crashed) throw new Error('Crash');
  useEffect(() => {
    window.__router = router;
    window.__crash = () => setCrashed(true);
    window.__inTransition = (method, to) =>
      new Promise((resolve) => {
        startTransition(async () => {
          try {
            await (method === 'reload'
              ? router.reload()
              : router[method](to as never));
            resolve('settled');
          } catch (error) {
            resolve(`rejected: ${String(error)}`);
          }
        });
      });
  });
  useLayoutEffect(() => {
    (window.__commits ??= []).push({
      route: router.path + (router.query ? '?' + router.query : ''),
      url: window.location.pathname + window.location.search,
    });
  });
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, background: '#fff' }}>
      <a href="/" data-testid="to-home">
        home
      </a>{' '}
      <a href="/long" data-testid="to-long">
        long
      </a>{' '}
      <a href="/long-static" data-testid="to-long-static">
        long-static
      </a>{' '}
      <a href="/short" data-testid="to-short">
        short
      </a>{' '}
      <a href="/focus" data-testid="to-focus">
        focus
      </a>{' '}
      <a href="/action" data-testid="to-action">
        action
      </a>{' '}
      <a href="/broken" data-testid="to-broken">
        broken
      </a>{' '}
      <a href="/gate" data-testid="to-gate">
        gate
      </a>{' '}
      <a href="/leave" data-testid="to-leave">
        leave
      </a>
      <span data-testid="route">
        {router.path}|{router.query}|{router.hash}
      </span>
    </nav>
  );
}
