async (page) => {
  const metrics = [];
  for (const [name, port] of [['baseline-6172854', 5188], ['storm-flight', 5187]]) {
    const samplePage = await page.context().newPage();
    await samplePage.setViewportSize({ width: 1280, height: 900 });
    await samplePage.addInitScript(() => {
      let seed = 246813579; Math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;
      };
    });
    await samplePage.goto(`http://127.0.0.1:${port}/play?mode=arcade`, {waitUntil:"domcontentloaded"});
    await samplePage.getByRole('button', { name: 'Launch Run', exact: true }).click();
    const sample = await samplePage.evaluate(async () => {
      const intervals = [], start = performance.now(); let last = start;
      await new Promise(done => {
        const tick = time => { intervals.push(time - last); last = time;
          if (time - start < 6000) requestAnimationFrame(tick); else done(); };
        requestAnimationFrame(tick);
      });
      const sorted = intervals.slice(2).sort((a, b) => a - b), c = document.querySelector('canvas');
      return { frames: sorted.length, medianMs: sorted[Math.floor(sorted.length * .5)],
        p95Ms: sorted[Math.floor(sorted.length * .95)], over33Ms: sorted.filter(ms => ms > 33.4).length,
        canvas: [c.width, c.height], rect: [c.clientWidth, c.clientHeight],
        score: document.body.textContent.match(/SCORE: [\d,]+/)?.[0],
        repair: !!document.querySelector('[data-repair-phase]') };
    });
    if (sample.repair || !sample.score || sample.score === 'SCORE: 0') throw new Error(`${name}: sample was not active gameplay`);
    metrics.push({ name, ...sample });
    await samplePage.keyboard.press('p');
    await samplePage.screenshot({ path: `output/playwright/${name}-performance.png` });
    await samplePage.close();
  }
  await page.evaluate(value => { window.neonQaPerformance = value; }, metrics);
}
