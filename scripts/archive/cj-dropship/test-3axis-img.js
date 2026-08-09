const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Test 1: basic img tag
  await page.setContent('<img src="https://cdn.3axis.co/user-images/joednz81.jpg" onerror="document.title=\'ERROR\'" onload="document.title=\'OK:\'+this.naturalWidth" />');
  await page.waitForTimeout(5000);
  console.log("Basic img:", await page.title());

  // Test 2: no-referrer
  await page.setContent('<img referrerpolicy="no-referrer" src="https://cdn.3axis.co/user-images/joednz81.jpg" onerror="document.title=\'ERR2\'" onload="document.title=\'OK2:\'+this.naturalWidth" />');
  await page.waitForTimeout(5000);
  console.log("No-referrer img:", await page.title());

  // Test 3: Check actual shop page loading behavior
  await page.goto("https://shop.lebon-grace.com/shop/mdf-fish-cutout");
  await page.waitForTimeout(6000);
  const allImgs = await page.locator("img").all();
  for (const img of allImgs) {
    const src = await img.getAttribute("src");
    if (src && src.includes("3axis")) {
      const w = await img.evaluate(el => el.naturalWidth);
      const display = await img.evaluate(el => getComputedStyle(el).display);
      const complete = await img.evaluate(el => el.complete);
      const err = await img.evaluate(el => el.getAttribute("data-error") || "none");
      console.log("3axis img:", src.substring(55, 75), "w=" + w, "display=" + display, "complete=" + complete, "err=" + err);
    }
  }

  await browser.close();
})();
