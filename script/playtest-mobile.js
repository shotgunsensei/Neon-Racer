async (page) => {
  const results = [], errors = [];
  const browser = page.context().browser();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const mobile = await context.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  const check = (value, label) => { if (!value) throw new Error(label); results.push(label); };
  await mobile.goto('http://127.0.0.1:5187/play?mode=racer');
  await mobile.getByRole('button', { name: 'Launch Run', exact: true }).click();
  await mobile.getByRole('button', { name: 'Move right', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Move right', exact: true }).tap();
  await mobile.waitForTimeout(400);
  check(await mobile.locator('[data-calm-effects="true"]').count() === 1, 'system reduced motion automatically enables Calm effects');
  check(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390 px portrait has no horizontal overflow');
  await mobile.getByRole('button', { name: 'Fire weapon', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Cockpit view', exact: true }).tap();
  check(await mobile.locator('canvas').getAttribute('data-view') === 'cockpit', 'touch changes camera during Racer gameplay');
  await mobile.screenshot({ path: 'output/playwright/mobile-cockpit.png' });
  await mobile.getByRole('radio', { name: /Chaos/ }).tap();
  await mobile.getByRole('button', { name: 'Launch Run', exact: true }).waitFor();
  check(await mobile.getByRole('button', { name: 'Launch Run', exact: true }).isVisible(), 'mode switch presents a fresh Chaos run');
  await mobile.getByRole('button', { name: 'Launch Run', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Move left', exact: true }).tap();
  await mobile.getByRole('button', { name: 'Move left', exact: true }).tap();
  await mobile.waitForTimeout(500);
  check((await mobile.locator('canvas').getAttribute('aria-label')).includes('Neon Racer'), 'Chaos touch controls keep the game actionable');
  await mobile.getByRole('button', { name: 'Cockpit view', exact: true }).tap();
  await mobile.screenshot({ path: 'output/playwright/mobile-chase.png' });
  const sizes = await mobile.locator('canvas').evaluate(c => ({ width: c.width, height: c.height, css: [c.clientWidth,c.clientHeight] }));
  check(sizes.width * sizes.height < 800 * 1000 * 4, 'mobile backing canvas uses fewer pixels than the former fixed DPR allocation');
  check(errors.length === 0, 'no runtime errors in touch and reduced-motion sessions');
  await page.evaluate(value => { window.neonQaMobile = value; }, { results, errors, sizes });
  await context.close();
}
