async (page) => {
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (condition, name) => { if (!condition) throw new Error(name); results.push(name); };
  const score = () => page.evaluate(() => Number(document.body.textContent.match(/SCORE: ([\d,]+)/)?.[1].replaceAll(',', '')));
  const shipX = () => page.evaluate(() => {
    const c = document.querySelector('canvas'), ctx = c.getContext('2d');
    const { data } = ctx.getImageData(0, 0, c.width, c.height); let sum = 0, count = 0;
    for (let y = Math.floor(c.height * .91); y < c.height * .965; y++) {
      for (let x = Math.floor(c.width * .1); x < c.width * .9; x++) {
        const i = (y * c.width + x) * 4;
        if (data[i] < 150 && data[i + 1] > 180 && data[i + 2] > 200) { sum += x; count++; }
      }
    }
    return count ? sum / count / c.width * 800 : NaN;
  });
  await page.addInitScript(() => { let seed = 123456789; Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;
  }; });
  await page.goto('http://127.0.0.1:5187/play?mode=arcade');
  await page.getByRole('button', { name: 'Launch Run', exact: true }).click();
  await page.waitForTimeout(100);
  const startX = await shipX();
  await page.keyboard.down('d'); await page.waitForTimeout(250); await page.keyboard.up('d');
  const rightX = await shipX();
  check(rightX > startX + 40, 'D steers the visible craft right');
  await page.keyboard.down('a'); await page.waitForTimeout(150); await page.keyboard.up('a');
  check(await shipX() < rightX - 15, 'A countersteers the visible craft left');
  await page.keyboard.press('a'); await page.waitForTimeout(70); await page.keyboard.press('a');
  await page.waitForTimeout(350);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(200); await page.keyboard.up('ArrowRight');
  const arrowX = await shipX();
  check(Number.isFinite(arrowX), 'double-tap roll and arrow-key steering retain a visible craft');
  await page.keyboard.down('a'); await page.keyboard.down('d');
  const bothX = await shipX(); await page.waitForTimeout(200);
  check(Math.abs(await shipX() - bothX) < 10, 'holding both directions brakes without drift');
  await page.keyboard.up('a'); await page.keyboard.up('d');
  await page.keyboard.down('Space'); await page.waitForTimeout(400); await page.keyboard.up('Space');
  await page.screenshot({ path: 'output/playwright/desktop-gameplay.png' });
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  const pausedScore = await score(); await page.waitForTimeout(250);
  check(await score() === pausedScore, 'pause freezes score');
  await page.getByRole('button', { name: 'Calm effects', exact: true }).click();
  check(await page.getByRole('button', { name: 'Calm effects', exact: true }).getAttribute('aria-pressed') === 'true', 'Calm effects toggles during an existing run');
  check(await score() === pausedScore, 'changing effects preserves progress');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.keyboard.press('v');
  check(await page.locator('canvas').getAttribute('data-view') === 'cockpit', 'V changes to cockpit during an existing run');
  await page.waitForTimeout(250);
  check(await score() > pausedScore, 'resume and camera change preserve advancing score');
  await page.screenshot({ path: 'output/playwright/cockpit-gameplay.png' });
  await page.keyboard.press('v');
  check(await page.locator('canvas').getAttribute('data-view') === 'chase', 'V returns to chase');
  await page.getByRole('button', { name: 'Calm effects', exact: true }).click();
  await page.locator('[data-repair-phase="command"]').waitFor({ timeout: 45000 });
  await page.screenshot({ path: 'output/playwright/repair-command.png' });
  const first = await page.locator('.repair-key.is-next').getAttribute('data-direction');
  await page.keyboard.press(first === 'left' ? 'ArrowRight' : 'ArrowLeft');
  await page.getByRole('dialog').waitFor({ timeout: 5000 });
  check(await page.getByRole('heading', { name: 'RUN COMPLETE', exact: true }).isVisible(), 'wrong repair command ends the run');
  await page.screenshot({ path: 'output/playwright/repair-failure.png' });
  await page.getByRole('button', { name: 'Skip and restart', exact: true }).click();
  await page.waitForTimeout(100);
  check(await score() < pausedScore, 'restart resets score');
  check(!await page.getByRole('dialog').count(), 'restart dismisses failure and starts a new run');
  await page.locator('[data-repair-phase="command"]').waitFor({ timeout: 45000 });
  const repairScore = await score();
  for (let round = 0; round < 3; round++) {
    await page.locator('[data-repair-phase="command"]').waitFor({ timeout: 6000 });
    const sequence = await page.locator('.repair-key').evaluateAll(keys => keys.map(key => key.dataset.direction));
    for (const direction of sequence) await page.keyboard.press(direction === 'left' ? 'ArrowLeft' : 'ArrowRight');
    await page.locator('[data-repair-phase="command"]').waitFor({ state: 'hidden', timeout: 1500 });
  }
  await page.locator('[data-repair-phase]').waitFor({ state: 'hidden', timeout: 6000 });
  check(await score() >= repairScore, 'successful repair returns to the original score');
  check(await page.getByText(/Repair complete/).isVisible(), 'successful repair grants visible re-entry immunity');
  await page.screenshot({ path: 'output/playwright/repair-success.png' });
  await page.keyboard.press('p');
  check(errors.length === 0, 'no runtime page errors during real controls and recovery');
  await page.evaluate(value => { window.neonQaResults = value; }, { results, errors });
}
