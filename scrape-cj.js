const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Try multiple pages of wooden toys
  const allProducts = [];
  
  for (let pageNum = 1; pageNum <= 3; pageNum++) {
    const url = `https://cjdropshipping.com/search/wooden+toys.html?pageNum=${pageNum}`;
    console.log(`\n--- Page ${pageNum} ---`);
    
    try {
      await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
      
      // Wait for potential Turnstile to resolve
      console.log('Waiting for page to load...');
      await page.waitForTimeout(15000);
      
      const currentUrl = page.url();
      console.log(`URL: ${currentUrl}`);
      
      // Take screenshot
      await page.screenshot({ path: `screenshots/cj-page-${pageNum}.png`, fullPage: true });
      
      // Try to extract products from the page
      const products = await page.evaluate(() => {
        const items = [];
        
        // CJ Dropshipping product card selectors
        const productCards = document.querySelectorAll('.productItem, .product-card, [class*="product-item"], [class*="goods-item"], .goodsItem, [data-product-id]');
        
        if (productCards.length === 0) {
          // Try broader selectors
          const allLinks = document.querySelectorAll('a[href*="/product/"], a[href*="detail"]');
          allLinks.forEach(link => {
            const card = link.closest('div') || link.parentElement;
            if (card) {
              const name = card.querySelector('[class*="name"], [class*="title"]')?.textContent?.trim() || link.textContent?.trim();
              const price = card.querySelector('[class*="price"]')?.textContent?.trim();
              const img = card.querySelector('img')?.src || card.querySelector('img')?.dataset?.src;
              if (name && name.length > 3) {
                items.push({
                  name: name.substring(0, 100),
                  price: price || '',
                  image: img || '',
                  link: link.href,
                  source: 'cj-dropshipping'
                });
              }
            }
          });
        } else {
          productCards.forEach(card => {
            const name = card.querySelector('[class*="name"], [class*="title"], h3, h4')?.textContent?.trim();
            const price = card.querySelector('[class*="price"]')?.textContent?.trim();
            const img = card.querySelector('img')?.src || card.querySelector('img')?.dataset?.src;
            const link = card.querySelector('a')?.href;
            const sales = card.querySelector('[class*="sold"], [class*="sales"]')?.textContent?.trim();
            
            if (name) {
              items.push({
                name: name.substring(0, 100),
                price: price || '',
                image: img || '',
                link: link || '',
                sales: sales || '',
                source: 'cj-dropshipping'
              });
            }
          });
        }
        
        return items;
      });
      
      console.log(`Found ${products.length} products on page ${pageNum}`);
      allProducts.push(...products);
      
      if (products.length === 0) {
        // Get page text for debugging
        const text = await page.locator('body').textContent().catch(() => '');
        console.log(`Page text: ${text.substring(0, 200)}`);
      }
      
    } catch (e) {
      console.log(`Error on page ${pageNum}: ${e.message.substring(0, 100)}`);
    }
  }
  
  console.log(`\n=== Total products found: ${allProducts.length} ===`);
  
  // Save all products
  fs.writeFileSync('screenshots/cj-all-products.json', JSON.stringify(allProducts, null, 2));
  console.log('Saved to screenshots/cj-all-products.json');

  // If no products found, save the page HTML for analysis
  if (allProducts.length === 0) {
    const html = await page.content();
    fs.writeFileSync('screenshots/cj-final.html', html);
    console.log('Saved page HTML for analysis');
  }

  await browser.close();
  console.log('\nDone!');
})();
