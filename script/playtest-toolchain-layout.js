async (page) => {
  const start = new URL(page.url());
  const stage = start.searchParams.get('qa') || 'baseline';
  if (!['baseline', 'tailwind-v4', 'vite-v8'].includes(stage)) throw new Error('Unknown QA stage');
  const records = [], errors = [];
  const browser = page.context().browser();
  for (const profile of [{ width: 1280, height: 900, touch: false },
    { width: 390, height: 844, touch: true }, { width: 900, height: 390, touch: true }]) {
    const context = await browser.newContext({ viewport: profile, hasTouch: profile.touch,
      isMobile: profile.touch, reducedMotion: 'reduce' });
    await context.route('**/api/scores', route => route.fulfill({ json: [] }));
    await context.route('https://fonts.googleapis.com/**', route => route.abort());
    await context.route('https://fonts.gstatic.com/**', route => route.abort());
    await context.addInitScript(() => { let seed = 123456789; Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;
    }; });
    const tab = await context.newPage();
    tab.on('pageerror', error => errors.push(error.message));
    const capture = async name => {
      // Paused/idle canvas drawing is throttled to 100 ms; allow a fresh frame.
      await tab.waitForTimeout(200);
      const data = await tab.evaluate(() => {
        const rect = element => { const r = element.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100); };
        const elements = [...document.querySelectorAll('main, header, footer, h1, h2, h3, p, kbd, aside, canvas, [role="radiogroup"], [role="radio"], button[aria-label], a[href="/play"], button')]
          .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
        return { overflow: document.documentElement.scrollWidth > innerWidth,
          calm: !!document.querySelector('[data-calm-effects="true"]'),
          elements: elements.map((e, index) => {
            const style = getComputedStyle(e);
            return { key: `${e.tagName}:${e.getAttribute('aria-label') || e.getAttribute('role') || e.textContent?.trim().slice(0, 45)}:${index}`,
              rect: rect(e), color: style.color, background: style.backgroundColor,
              border: [style.borderTopWidth, style.borderTopColor], radius: style.borderRadius,
              font: [style.fontFamily, style.fontSize, style.lineHeight], cursor: style.cursor,
              outline: [style.outlineStyle, style.outlineWidth, style.outlineOffset],
              blur: style.backdropFilter, shadow: style.boxShadow };
          }) };
      });
      if (data.overflow) throw new Error(`${stage} ${name} horizontal overflow`);
      const id = `${profile.width}x${profile.height}-${name}`;
      await tab.screenshot({ path: `output/playwright/${stage}-${id}.png` });
      records.push({ id, ...data });
    };
    await tab.goto(`${start.origin}/`);
    await tab.getByRole('link', { name: /Initialize run/ }).waitFor();
    await tab.evaluate(() => document.fonts.ready);
    await capture('home');
    await tab.goto(`${start.origin}/play?mode=arcade`);
    await tab.getByRole('button', { name: 'Launch Run', exact: true }).waitFor();
    await capture('ready');
    await tab.getByRole('button', { name: 'Launch Run', exact: true }).click();
    await tab.waitForTimeout(100);
    await tab.keyboard.press('p');
    await tab.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    await capture('chase-paused');
    await tab.getByRole('button', { name: 'Cockpit view', exact: true }).click();
    if (await tab.locator('canvas').getAttribute('data-view') !== 'cockpit' ||
      await tab.getByRole('button', { name: 'Cockpit view', exact: true }).getAttribute('aria-pressed') !== 'true') {
      throw new Error('Camera switch did not commit');
    }
    await capture('cockpit-paused');
    await context.close();
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await page.evaluate(value => { window.neonToolchainLayout = value; }, { stage, records, errors });
}
