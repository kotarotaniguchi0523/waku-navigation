import type { Page } from '@playwright/test';

export type NavigationRecord = {
  type: 'navigate' | 'navigatesuccess' | 'navigateerror';
  navigationType?: string;
  url: string;
  page: string | null;
  active: string | null;
  state: unknown;
};

type RouterMethod = 'push' | 'replace' | 'reload';

// What the fixtures' components put on window.
declare global {
  interface Window {
    __router?: {
      push: (to: string, options?: { scroll?: boolean }) => Promise<void>;
      replace: (to: string, options?: { scroll?: boolean }) => Promise<void>;
      reload: () => Promise<void>;
      back: () => void;
      forward: () => void;
      prefetch: (to: string) => void;
    };
    __inTransition?: (method: RouterMethod, to?: string) => Promise<string>;
    __commits?: { route: string; url: string }[];
    __events?: NavigationRecord[];
    __unhandled?: string[];
    __crash?: () => void;
    // Set by a test; gone once the document has been replaced.
    __sentinel?: boolean;
    // How a router promise ended: 'resolved' or 'rejected: <error>'.
    __settle?: (promise: Promise<void>) => Promise<string>;
  }
}

// The fixtures publish the router from an effect, so it marks hydration.
export const waitForRouter = (page: Page) =>
  page.waitForFunction(() => !!window.__router, null, { timeout: 60_000 });

export function watchPage(page: Page) {
  const errors: string[] = [];
  const rscRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/RSC/')) rscRequests.push(url.pathname);
  });
  return { errors, rscRequests };
}

// Records Navigation API events from before the app boots. React's fake
// transition-indicator navigations are left out.
export async function recordNavigation(page: Page) {
  await page.addInitScript(() => {
    const events: NavigationRecord[] = (window.__events = []);
    const unhandled: string[] = (window.__unhandled = []);
    window.addEventListener('unhandledrejection', (event) => {
      unhandled.push(String(event.reason));
    });
    window.__settle = (promise) =>
      promise.then(
        () => 'resolved',
        (error: unknown) => `rejected: ${String(error)}`,
      );
    let indicator = false;
    const record = (
      type: NavigationRecord['type'],
      navigationType?: string,
      url = window.location.href,
    ) => {
      const { pathname, search, hash } = new URL(url);
      const active = document.activeElement;
      events.push({
        type,
        ...(navigationType ? { navigationType } : {}),
        url: pathname + search + hash,
        page: document.querySelector('[data-testid=page]')?.textContent ?? null,
        active: active?.getAttribute('data-testid') ?? active?.tagName ?? null,
        state: window.navigation.currentEntry?.getState(),
      });
    };
    window.navigation.addEventListener('navigate', (event) => {
      indicator = event.info === 'react-transition';
      if (!indicator) {
        record('navigate', event.navigationType, event.destination.url);
      }
    });
    window.navigation.addEventListener('navigatesuccess', () => {
      if (!indicator) record('navigatesuccess');
    });
    window.navigation.addEventListener('navigateerror', () => {
      if (!indicator) record('navigateerror');
    });
  });
}

export const navigationEvents = (page: Page) =>
  page.evaluate(() => window.__events!);

export const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
