const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const out = 'C:\\Users\\user\\Desktop\\aprojects\\lebon-grace\\screenshots';

  console.log('1. Homepage...');
  await page.goto('https://shop.lebon-grace.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/final-01-home.png', fullPage: true });
  console.log('   OK');

  console.log('2. Shop page...');
  await page.goto('https://shop.lebon-grace.com/shop', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/final-02-shop.png', fullPage: false });
  console.log('   OK');

  console.log('3. Product detail...');
  const links = await page.$$eval('a[href*="/shop/"]', els => 
    els.map(a => a.href).filter(h => h.includes('/shop/') && !h.endsWith('/shop'))
  );
  if (links.length > 0) {
    await page.goto(links[0], { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: out + '/final-03-product.png', fullPage: false });
    console.log('   OK: ' + links[0]);
  }

  console.log('4. Mobile shop...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('https://shop.lebon-grace.com/shop', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/final-04-mobile-shop.png', fullPage: false });
  console.log('   OK');

  console.log('5. Mobile homepage...');
  await page.goto('https://shop.lebon-grace.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/final-05-mobile-home.png', fullPage: false });
  console.log('   OK');

  // Check for WhatsApp button
  console.log('6. WhatsApp button check...');
  const whatsapp = await page.locator('a[href*="wa.me"]').count();
  console.log('   WhatsApp button: ' + (whatsapp > 0 ? 'PRESENT' : 'MISSING'));

  // Check for green Add to Cart buttons
  console.log('7. Green Add to Cart check...');
  const greenButtons = await page.locator('button.bg-\\[\\#16A34A\\]').count();
  console.log('   Green buttons: ' + greenButtons);

  // Check for sort dropdown
  console.log('8. Sort dropdown check...');
  const sortDropdown = await page.locator('select').count();
  console.log('   Sort dropdowns: ' + sortDropdown);

  // Check font
  console.log('9. Font check...');
  const headingFont = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? window.getComputedStyle(h1).fontFamily : 'not found';
  });
  console.log('   Heading font: ' + headingFont);

  await browser.close();
  console.log('\nAll checks complete!');
})();
