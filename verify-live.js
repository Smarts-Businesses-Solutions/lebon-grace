const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const out = 'C:\\Users\\user\\Desktop\\aprojects\\lebon-grace\\screenshots';

  // Shop page
  console.log('1. Shop page...');
  await page.goto('https://shop.lebon-grace.com/shop', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/live-shop.png', fullPage: false });
  
  // Check for filter buttons
  const buttons = await page.$$eval('button', els => els.map(el => el.textContent?.trim()).filter(t => t && t.length < 30));
  console.log('Buttons found:', buttons.length);
  buttons.slice(0, 20).forEach(b => console.log(`  • ${b}`));

  // Check for products
  const products = await page.$$eval('h3', els => els.map(el => el.textContent?.trim()).filter(Boolean));
  console.log(`\nProducts: ${products.length}`);

  // Check for sort dropdown
  const selects = await page.$$eval('select', els => els.map(el => el.textContent?.trim()));
  console.log(`Sort dropdowns: ${selects.length}`);

  // Homepage
  console.log('\n2. Homepage...');
  await page.goto('https://shop.lebon-grace.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/live-home.png', fullPage: false });

  // Check category images
  const catImages = await page.$$eval('img[alt]', imgs => 
    imgs.filter(img => img.closest('a[href*="category"]')).map(img => img.alt)
  );
  console.log(`Category images: ${catImages.length}`);
  catImages.forEach(c => console.log(`  • ${c}`));

  // Admin page
  console.log('\n3. Admin page...');
  await page.goto('https://shop.lebon-grace.com/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/live-admin.png', fullPage: false });
  console.log('Admin screenshot taken');

  await browser.close();
  console.log('\nDone!');
})();
