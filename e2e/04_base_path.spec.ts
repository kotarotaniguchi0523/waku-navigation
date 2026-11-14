import { expect, test } from '@playwright/test';
import { waitForRouter, watchPage } from './utils.js';

test.use({ baseURL: `http://localhost:${process.env.E2E_PORT_04_BASE_PATH}` });

test('a protocol-relative or absolute `to` is left alone under a base path', async ({
  page,
}) => {
  await page.goto('/app/');
  await waitForRouter(page);
  await expect(page.getByTestId('internal')).toHaveAttribute(
    'href',
    '/app/about',
  );
  await expect(page.getByTestId('protocol-relative')).toHaveAttribute(
    'href',
    '//example.com/page',
  );
  await expect(page.getByTestId('absolute')).toHaveAttribute(
    'href',
    'https://example.com/page',
  );
});

test('prefetch ignores another origin and fetches an internal route', async ({
  page,
}) => {
  const { errors, rscRequests } = watchPage(page);
  await page.goto('/app/');
  await waitForRouter(page);
  await page.getByTestId('protocol-relative').hover();
  await page.getByTestId('absolute').hover();
  await page.evaluate(() =>
    window.__router!.prefetch('https://example.com/other'),
  );
  await page.getByTestId('internal').hover();
  await expect.poll(() => rscRequests).toEqual(['/app/RSC/R/about.txt']);
  expect(errors).toEqual([]);
});

test('an internal link navigates client-side under the base path', async ({
  page,
}) => {
  await page.goto('/app/');
  await waitForRouter(page);
  await page.evaluate(() => {
    window.__sentinel = true;
  });
  await page.getByTestId('internal').click();
  await expect(page.getByTestId('page')).toHaveText('about');
  await expect(page).toHaveURL('/app/about');
  await expect(page.getByTestId('route')).toHaveText('/about');
  expect(await page.evaluate(() => window.__sentinel)).toBe(true);
});

test('a same-origin link outside the base path loads as a document', async ({
  page,
}) => {
  const { errors, rscRequests } = watchPage(page);
  await page.goto('/app/');
  await waitForRouter(page);
  await page.evaluate(() => {
    window.__sentinel = true;
  });
  await page.getByTestId('outside').click();
  await expect(page).toHaveURL('/outside');
  await expect
    .poll(() => page.evaluate(() => window.__sentinel))
    .toBeUndefined();
  expect(rscRequests).toEqual([]);
  expect(errors).toEqual([]);
});
