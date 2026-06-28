const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const outDir = 'C:\\Users\\user\\Desktop\\aprojects\\lebon-grace\\screenshots';
  const fs = require('fs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const base = 'http://localhost:3001';

  async function shot(url, name) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
    console.log(`✅ ${name}.png`);
  }

  // Desktop
  console.log('\n=== DESKTOP ===');
  await shot(base, '01-homepage');
  await shot(base + '/shop', '02-shop');
  
  // Product page
  await page.goto(base + '/shop', { waitUntil: 'networkidle' });
  const productLinks = await page.$$eval('a[href*="/shop/"]', (links) => 
    links.map(a => a.href).filter(h => h.includes('/shop/') && !h.endsWith('/shop'))
  );
  if (productLinks.length > 0) {
    await shot(productLinks[0], '03-product');
  }
  
  await shot(base + '/about', '04-about');
  await shot(base + '/faq', '05-faq');
  await shot(base + '/cart', '06-cart');
  await shot(base + '/checkout', '07-checkout');

  // Mobile
  console.log('\n=== MOBILE ===');
  await page.setViewportSize({ width: 375, height: 812 });
  await shot(base, '08-mobile-home');
  await shot(base + '/shop', '09-mobile-shop');

  await browser.close();
  console.log('\n✅ All screenshots done!');
})();
