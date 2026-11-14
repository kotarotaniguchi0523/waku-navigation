import { expect, test, type Page } from '@playwright/test';
import {
  navigationEvents,
  recordNavigation,
  scrollY,
  waitForRouter,
  watchPage,
} from './utils.js';

test.use({ baseURL: `http://localhost:${process.env.E2E_PORT_03_NAVIGATION}` });

const open = async (page: Page, path: string) => {
  await recordNavigation(page);
  await page.goto(path);
  await waitForRouter(page);
};

const pageName = (page: Page) => page.getByTestId('page');

const holdResponse = (page: Page, pattern: string) => {
  let release!: () => void;
  let requested!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  void page.route(pattern, async (route) => {
    requested();
    await gate;
    await route.continue().catch(() => {});
  });
  return { requested: started, release };
};

// No navigation may be left in flight: a pending one keeps the browser's
// loading indicator on and blocks its scroll and focus handling.
const expectNoTransition = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => window.navigation.transition === null))
    .toBe(true);

test.describe('navigation completes after React commits the destination', () => {
  test('navigatesuccess fires with the destination in the DOM', async ({
    page,
  }) => {
    await open(page, '/');
    await page.getByTestId('to-long').click();
    await expect
      .poll(async () => (await navigationEvents(page)).map((e) => e.type))
      .toEqual(['navigate', 'navigatesuccess']);
    const [, success] = await navigationEvents(page);
    expect(success).toMatchObject({ url: '/long', page: 'long' });
  });

  for (const target of ['long', 'long-static']) {
    test(`back restores the scroll position and state of /${target}`, async ({
      page,
    }) => {
      await open(page, '/short');
      await page.evaluate(
        (path) => window.navigation.navigate(path, { state: { step: 1 } }),
        `/${target}`,
      );
      await expect(pageName(page)).toHaveText(target);
      await page.evaluate(() => window.scrollTo(0, 4000));
      await expect.poll(() => scrollY(page)).toBe(4000);
      await page.getByTestId('to-short').click();
      await expect(pageName(page)).toHaveText('short');
      await expect.poll(() => scrollY(page)).toBe(0);

      await page.goBack();
      await expect(pageName(page)).toHaveText(target);
      await expect.poll(() => scrollY(page)).toBe(4000);
      expect(
        await page.evaluate(() => window.navigation.currentEntry!.getState()),
      ).toEqual({ step: 1 });

      await page.goForward();
      await expect(pageName(page)).toHaveText('short');
      await page.evaluate(() => window.__router!.back());
      await expect(pageName(page)).toHaveText(target);
      await expect.poll(() => scrollY(page)).toBe(4000);
    });
  }

  test('a push scrolls to the top, also when only the query changes', async ({
    page,
  }) => {
    await open(page, '/');
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.evaluate(() => window.__router!.push('/?tab=2'));
    await expect(page.getByTestId('route')).toHaveText('/|tab=2|');
    await expect.poll(() => scrollY(page)).toBe(0);
  });

  test('a push to a fragment scrolls to its element in the new page', async ({
    page,
  }) => {
    await open(page, '/short');
    await page.evaluate(() => window.__router!.push('/#frag'));
    await expect(pageName(page)).toHaveText('home');
    await expect(page.getByTestId('route')).toHaveText('/||#frag');
    await expect.poll(() => scrollY(page)).toBeGreaterThan(2000);
  });

  test('focus stays put while loading, then resets against the new page', async ({
    page,
  }) => {
    await open(page, '/');
    await page.getByTestId('to-long').focus();
    await page.keyboard.press('Enter');
    // Still loading: the old page, with focus where the user left it.
    await expect(pageName(page)).toHaveText('home');
    expect(
      await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid'),
      ),
    ).toBe('to-long');
    await expect(pageName(page)).toHaveText('long');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName))
      .toBe('BODY');
    const events = await navigationEvents(page);
    expect(events.at(-1)).toMatchObject({
      type: 'navigatesuccess',
      page: 'long',
      active: 'BODY',
    });
  });

  test('the focus reset lands on the new page’s autofocus element', async ({
    page,
  }) => {
    await open(page, '/');
    await page.getByTestId('to-focus').focus();
    await page.keyboard.press('Enter');
    await expect(pageName(page)).toHaveText('focus');
    await expect(page.getByTestId('auto')).toBeFocused();
    const events = await navigationEvents(page);
    expect(events.at(-1)).toMatchObject({
      type: 'navigatesuccess',
      page: 'focus',
      active: 'auto',
    });
  });
});

test.describe('the URL commits with the route', () => {
  test('the address bar keeps the old URL until the route responds', async ({
    page,
  }) => {
    await open(page, '/');
    const response = holdResponse(page, '**/RSC/R/short*');
    await page.evaluate(() => void window.__router!.push('/short'));
    await response.requested;
    await expect(pageName(page)).toHaveText('home');
    await expect(page).toHaveURL('/');
    expect(await page.evaluate(() => !!window.navigation.transition)).toBe(
      true,
    );

    response.release();
    await expect(pageName(page)).toHaveText('short');
    await expect(page).toHaveURL('/short');
    // No commit ever showed a route under another route's URL.
    const commits = await page.evaluate(() => window.__commits!);
    expect(commits.filter(({ route, url }) => route !== url)).toEqual([]);
  });

  test('a redirect is one navigation that lands on the final URL', async ({
    page,
  }) => {
    await open(page, '/');
    const entries = await page.evaluate(
      () => window.navigation.entries().length,
    );
    const atSettle = await page.evaluate(async () => {
      await window.navigation.navigate('/old', { state: { from: 'home' } })
        .finished;
      return {
        url: window.location.pathname,
        page: document.querySelector('[data-testid=page]')?.textContent,
      };
    });
    expect(atSettle).toEqual({ url: '/new', page: 'new' });
    const events = await navigationEvents(page);
    expect(events.map((e) => [e.type, e.navigationType, e.url])).toEqual([
      ['navigate', 'push', '/old'],
      ['navigatesuccess', undefined, '/new'],
    ]);
    expect(events[1]).toMatchObject({ page: 'new', state: { from: 'home' } });
    expect(await page.evaluate(() => window.navigation.entries().length)).toBe(
      entries + 1,
    );
    const commits = await page.evaluate(() => window.__commits!);
    expect(commits.map((commit) => commit.url)).not.toContain('/old');

    await page.goBack();
    await expect(pageName(page)).toHaveText('home');
    await expect(page).toHaveURL('/');
  });

  test('an entry that now redirects is replaced when traversed to or reloaded', async ({
    page,
  }) => {
    await open(page, '/action');
    await page.getByTestId('open-gate').click();
    await page.evaluate(() =>
      window.navigation.navigate('/gate', { state: { kept: true } }),
    );
    await expect(pageName(page)).toHaveText('gate');
    await page.getByTestId('to-action').click();
    await expect(pageName(page)).toHaveText('action');
    await page.getByTestId('close-gate').click();
    const entries = await page.evaluate(
      () => window.navigation.entries().length,
    );
    const { rscRequests } = watchPage(page);
    try {
      await page.goBack();
      await expect(pageName(page)).toHaveText('new');
      await expect(page).toHaveURL('/new');
      await expectNoTransition(page);
      expect(
        await page.evaluate(() => ({
          entries: window.navigation.entries().length,
          state: window.navigation.currentEntry!.getState(),
        })),
      ).toEqual({ entries, state: { kept: true } });
      expect(await page.evaluate(() => window.__unhandled!)).toEqual([]);
      // The redirect target came with the first response.
      expect(rscRequests.filter((path) => path.includes('new'))).toHaveLength(
        1,
      );
      const commits = await page.evaluate(() => window.__commits!);
      expect(commits.filter(({ route, url }) => route !== url)).toEqual([]);

      await page.goForward();
      await expect(pageName(page)).toHaveText('action');
    } finally {
      await page.getByTestId('open-gate').click();
    }
  });

  // Simulated in Chromium by removing the interface; other engines are not run.
  test('without precommitHandler, a redirect still lands on the final URL', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      delete (window as { NavigationPrecommitController?: unknown })
        .NavigationPrecommitController;
    });
    await open(page, '/');
    const entries = await page.evaluate(
      () => window.navigation.entries().length,
    );
    const { rscRequests } = watchPage(page);
    await page.evaluate(() =>
      window.navigation.navigate('/old', { state: { from: 'home' } }),
    );
    await expect(pageName(page)).toHaveText('new');
    await expect(page).toHaveURL('/new');
    await expectNoTransition(page);
    expect(
      await page.evaluate(() => ({
        entries: window.navigation.entries().length,
        state: window.navigation.currentEntry!.getState(),
      })),
    ).toEqual({ entries: entries + 1, state: { from: 'home' } });
    expect(rscRequests.filter((path) => path.includes('new'))).toHaveLength(1);
    const commits = await page.evaluate(() => window.__commits!);
    expect(commits.filter(({ route, url }) => route !== url)).toEqual([]);
  });

  test('the router keeps working when the user cancels leaving the document', async ({
    page,
  }) => {
    await open(page, '/');
    await page.evaluate(() => {
      window.__sentinel = true;
      window.addEventListener('beforeunload', (event) =>
        event.preventDefault(),
      );
    });
    page.once('dialog', (dialog) => void dialog.dismiss());
    await page.getByTestId('to-leave').click();
    await expectNoTransition(page);
    await expect(page).toHaveURL('/');
    await expect(pageName(page)).toHaveText('home');

    await page.getByTestId('to-short').click();
    await expect(pageName(page)).toHaveText('short');
    await expect(page).toHaveURL('/short');
    expect(await page.evaluate(() => window.__sentinel)).toBe(true);
    expect(await page.evaluate(() => window.__unhandled!)).toEqual([]);
  });

  test('a redirect to another origin leaves without a stray entry', async ({
    page,
  }) => {
    await page.route('https://example.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>external</h1>' }),
    );
    await open(page, '/');
    await page.getByTestId('to-leave').click();
    await expect(page).toHaveURL('https://example.com/landing');
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(pageName(page)).toHaveText('home');
  });
});

test.describe('router promises', () => {
  test('push() resolves with the URL committed, also after a redirect', async ({
    page,
  }) => {
    await open(page, '/');
    const urls = await page.evaluate(async () => {
      const router = window.__router!;
      const seen: string[] = [];
      await router.push('/short');
      seen.push(window.location.pathname);
      await router.push('/old');
      seen.push(window.location.pathname);
      await router.replace('/long');
      seen.push(window.location.pathname);
      return seen;
    });
    expect(urls).toEqual(['/short', '/new', '/long']);
    await expect(pageName(page)).toHaveText('long');
  });

  for (const method of ['push', 'replace'] as const) {
    test(`${method}() awaited inside an async transition settles`, async ({
      page,
    }) => {
      await open(page, '/');
      // React holds the commit until the action ends, so the promise has to
      // settle before the destination is in the DOM.
      const settled = await page.evaluate(
        (m) => window.__inTransition!(m, '/long'),
        method,
      );
      expect(settled).toBe('settled');
      await expect(pageName(page)).toHaveText('long');
      await expect(page).toHaveURL('/long');
    });
  }

  test('a superseded push settles, never reaches the DOM and leaves no entry', async ({
    page,
  }) => {
    await open(page, '/');
    const response = holdResponse(page, '**/RSC/R/long*');
    const first = page.evaluate(() =>
      window.__settle!(window.__router!.push('/long')),
    );
    await response.requested;
    const second = page.evaluate(() =>
      window.__settle!(window.__router!.push('/short')),
    );
    expect(await Promise.all([first, second])).toEqual([
      'resolved',
      'resolved',
    ]);
    await expect(pageName(page)).toHaveText('short');
    await expect(page).toHaveURL('/short');
    response.release();
    await expectNoTransition(page);
    await expect(pageName(page)).toHaveText('short');
    const routes = await page.evaluate(() =>
      window.__commits!.map((commit) => commit.route),
    );
    expect(routes).not.toContain('/long');
    expect(await page.evaluate(() => window.__unhandled!)).toEqual([]);
    // The superseded navigation never committed, so it left no entry.
    expect(
      await page.evaluate(() =>
        window.navigation
          .entries()
          .map((entry) => new URL(entry.url!).pathname),
      ),
    ).toEqual(['/', '/short']);
  });
});

test.describe('reload', () => {
  test('reload() refetches the route and keeps the scroll position', async ({
    page,
  }) => {
    await open(page, '/action');
    await page.evaluate(() => window.scrollTo(0, 500));
    const { rscRequests } = watchPage(page);
    expect(
      await page.evaluate(() => window.__settle!(window.__router!.reload())),
    ).toBe('resolved');
    await expect
      .poll(() => rscRequests.filter((path) => path.includes('action')))
      .toHaveLength(1);
    await expectNoTransition(page);
    expect(await scrollY(page)).toBe(500);
    const events = await navigationEvents(page);
    expect(events.map((e) => [e.type, e.navigationType])).toEqual([
      ['navigate', 'reload'],
      ['navigatesuccess', undefined],
    ]);
  });

  test('reload() awaited inside an async transition settles', async ({
    page,
  }) => {
    await open(page, '/action');
    expect(await page.evaluate(() => window.__inTransition!('reload'))).toBe(
      'settled',
    );
    await expectNoTransition(page);
  });
});

test.describe('entry state', () => {
  test('reload() keeps the state of the current entry', async ({ page }) => {
    await open(page, '/action');
    await page.evaluate(() =>
      window.navigation.updateCurrentEntry({ state: { draft: 2 } }),
    );
    await page.evaluate(() => window.__router!.reload());
    await expectNoTransition(page);
    expect(
      await page.evaluate(() => window.navigation.currentEntry!.getState()),
    ).toEqual({ draft: 2 });
  });
});

test.describe('failures settle the navigation', () => {
  test('a failed load rejects the promise and shows the error at the destination', async ({
    page,
  }) => {
    await open(page, '/');
    await page.route('**/RSC/R/short*', (route) => route.abort());
    const result = await page.evaluate(() =>
      window.__settle!(window.__router!.push('/short')),
    );
    expect(result).toContain('rejected');
    await expect(page.getByTestId('error-fallback')).toBeVisible();
    await expect(page).toHaveURL('/short');
    await expectNoTransition(page);
    expect((await navigationEvents(page)).map((e) => e.type)).toEqual([
      'navigate',
      'navigateerror',
    ]);

    // Retrying remounts the router, which loads the address bar's route.
    expect(await page.evaluate(() => window.__unhandled!)).toEqual([]);
    await page.unroute('**/RSC/R/short*');
    await page.getByTestId('retry').click();
    await expect(pageName(page)).toHaveText('short');
  });

  test('a destination that fails to render settles and can be left', async ({
    page,
  }) => {
    await open(page, '/');
    const result = await page.evaluate(() =>
      window.__settle!(window.__router!.push('/broken')),
    );
    expect(result).toBe('resolved');
    // waku's own boundary inside <Root> catches this one.
    await expect(page.getByText('Render failure')).toBeVisible();
    await expect(page).toHaveURL('/broken');
    await expectNoTransition(page);

    // The router is unmounted, so the browser handles navigations itself.
    await page.goBack();
    await expect(page).toHaveURL('/');
    await page.reload();
    await expect(pageName(page)).toHaveText('home');
  });

  test('unmounting the router mid-navigation settles it', async ({ page }) => {
    await open(page, '/');
    const result = await page.evaluate(async () => {
      const pushed = window.__settle!(window.__router!.push('/long?d=600'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      window.__crash!();
      return pushed;
    });
    expect(result).toBe('resolved');
    await expect(page.getByText('Crash')).toBeVisible();
    await expectNoTransition(page);
  });
});

test.describe('server functions', () => {
  test('requestRefresh() keeps the entry state, focus and history length', async ({
    page,
  }) => {
    await open(page, '/');
    await page.evaluate(() =>
      window.navigation.navigate('/action', { state: { draft: 1 } }),
    );
    await expect(pageName(page)).toHaveText('action');
    const before = Number(await page.getByTestId('count').textContent());
    const entries = await page.evaluate(
      () => window.navigation.entries().length,
    );
    await page.getByTestId('refresh').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('count')).toHaveText(String(before + 1));
    await expect(page.getByTestId('refresh')).toBeFocused();
    expect(
      await page.evaluate(() => ({
        state: window.navigation.currentEntry!.getState(),
        entries: window.navigation.entries().length,
      })),
    ).toEqual({ state: { draft: 1 }, entries });
    const events = await navigationEvents(page);
    expect(events.at(-2)).toMatchObject({
      type: 'navigate',
      navigationType: 'reload',
    });
  });
});
