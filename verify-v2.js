const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const out = 'C:\\Users\\user\\Desktop\\aprojects\\lebon-grace\\screenshots';

  // Homepage
  console.log('1. Homepage...');
  await page.goto('https://shop.lebon-grace.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/v2-01-home.png', fullPage: true });
  console.log('   OK');

  // Shop
  console.log('2. Shop...');
  await page.goto('https://shop.lebon-grace.com/shop', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/v2-02-shop.png', fullPage: false });
  console.log('   OK');

  // Count category images (check if they're real images not placeholders)
  await page.goto('https://shop.lebon-grace.com/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const categoryImages = await page.$$eval('.aspect-square img', imgs => 
    imgs.filter(img => img.src && !img.src.includes('data:')).length
  );
  console.log('3. Real category images: ' + categoryImages);

  const placeholderCount = await page.$$eval('.aspect-square', divs => divs.length);
  console.log('   Total category cards: ' + placeholderCount);

  await browser.close();
  console.log('\nDone!');
})();
