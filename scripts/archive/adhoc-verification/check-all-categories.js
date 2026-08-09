const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const out = 'C:\\Users\\user\\Desktop\\aprojects\\lebon-grace\\screenshots';

  // Screenshot the Jewelry category page
  console.log('1. Jewelry category...');
  await page.goto('https://shop.lebon-grace.com/shop?category=Jewelry', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/jewelry-check.png', fullPage: false });
  
  // Get all product names visible on page
  const products = await page.$$eval('h3', els => els.map(el => el.textContent?.trim()).filter(Boolean));
  console.log(`Products visible: ${products.length}`);
  products.forEach(p => console.log(`  • ${p}`));

  // Screenshot Beauty category
  console.log('\n2. Beauty category...');
  await page.goto('https://shop.lebon-grace.com/shop?category=Beauty+%26+Grooming', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/beauty-check.png', fullPage: false });
  const beautyProds = await page.$$eval('h3', els => els.map(el => el.textContent?.trim()).filter(Boolean));
  console.log(`Products visible: ${beautyProds.length}`);
  beautyProds.forEach(p => console.log(`  • ${p}`));

  // Screenshot Fashion category
  console.log('\n3. Fashion category...');
  await page.goto('https://shop.lebon-grace.com/shop?category=Fashion+%26+Accessories', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/fashion-check.png', fullPage: false });
  const fashionProds = await page.$$eval('h3', els => els.map(el => el.textContent?.trim()).filter(Boolean));
  console.log(`Products visible: ${fashionProds.length}`);
  fashionProds.forEach(p => console.log(`  • ${p}`));

  // Screenshot Kitchen category
  console.log('\n4. Kitchen category...');
  await page.goto('https://shop.lebon-grace.com/shop?category=Kitchen+%26+Dining', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/kitchen-check.png', fullPage: false });
  const kitchenProds = await page.$$eval('h3', els => els.map(el => el.textContent?.trim()).filter(Boolean));
  console.log(`Products visible: ${kitchenProds.length}`);
  kitchenProds.forEach(p => console.log(`  • ${p}`));

  // Screenshot Pet category
  console.log('\n5. Pet category...');
  await page.goto('https://shop.lebon-grace.com/shop?category=Pet+Supplies', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: out + '/pet-check.png', fullPage: false });
  const petProds = await page.$$eval('h3', els => els.map(el => el.textContent?.trim()).filter(Boolean));
  console.log(`Products visible: ${petProds.length}`);
  petProds.slice(0, 10).forEach(p => console.log(`  • ${p}`));

  await browser.close();
  console.log('\nDone!');
})();
