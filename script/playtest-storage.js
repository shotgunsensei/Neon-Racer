// Fault injection is confined to new disposable browser contexts.
async (page) => {
  const origin = new URL(page.url()).origin;
  const results = [];
  for (const scenario of ["storage-denied", "write-quota"]) {
    const context = await page.context().browser().newContext();
    const game = await context.newPage(), errors = [];
    game.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(scenario => {
      if (scenario === "storage-denied") {
        Object.defineProperty(window, "localStorage", {
          get() { throw new DOMException("Fixture storage denied", "SecurityError"); },
        });
      } else {
        Storage.prototype.setItem = () => { throw new DOMException("Fixture quota exceeded", "QuotaExceededError"); };
      }
    }, scenario);
    try {
      await game.goto(origin + "/play");
      await game.getByRole("button", { name: "Launch Run", exact: true }).click();
      const score = () => game.evaluate(() => Number(document.body.textContent.match(/SCORE: ([\d,]+)/)?.[1].replaceAll(",", "")));
      const initial = await score();
      await game.waitForTimeout(350);
      if (!(await score() > initial)) throw new Error(scenario + ": gameplay must advance");
      await game.getByRole("button", { name: "Mute game audio", exact: true }).click();
      await game.getByRole("button", { name: "Enable game audio", exact: true }).click();
      await game.getByRole("button", { name: "Mute game audio", exact: true }).waitFor();
      await game.keyboard.press("p");
      await game.getByRole("button", { name: "Resume", exact: true }).waitFor();
      await game.screenshot({ path: `output/playwright/${scenario}-playable.png` });
      if (errors.length) throw new Error(scenario + ": " + errors.join("; "));
      results.push({ scenario, bootLaunchScoreAdvance: true, sessionMuteToggle: true, pageErrors: errors });
    } finally {
      await context.close();
    }
  }
  return results;
}
