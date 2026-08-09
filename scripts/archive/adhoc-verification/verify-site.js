const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const out = 'C:\\Users\\user\\Desktop\\aprojects\\lebon-grace\\screenshots';

  // 1. Homepage
  console.log('1. Homepage...');
  await page.goto('https://shop.lebon-grace.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/verify-01-home.png', fullPage: true });
  console.log('   Saved');

  // 2. Shop page
  console.log('2. Shop page...');
  await page.goto('https://shop.lebon-grace.com/shop', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/verify-02-shop.png', fullPage: true });
  console.log('   Saved');

  // 3. First product detail
  console.log('3. First product...');
  const links = await page.$$eval('a[href*="/shop/"]', els => 
    els.map(a => a.href).filter(h => h.includes('/shop/') && !h.endsWith('/shop'))
  );
  console.log('   Product links found:', links.length);
  if (links.length > 0) {
    await page.goto(links[0], { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: out + '/verify-03-product.png', fullPage: true });
    console.log('   Saved: ' + links[0]);
  }

  // 4. Mobile view of shop
  console.log('4. Mobile shop...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('https://shop.lebon-grace.com/shop', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/verify-04-mobile-shop.png', fullPage: true });
  console.log('   Saved');

  await browser.close();
  console.log('\nDone!');
})();
