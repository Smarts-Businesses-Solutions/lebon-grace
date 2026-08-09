const { chromium } = require('playwright');

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

  console.log('Going to Hostinger API page...');
  await page.goto('https://hpanel.hostinger.com/api', { timeout: 60000, waitUntil: 'domcontentloaded' });
  
  // Wait longer for Cloudflare
  console.log('Waiting 15s for Cloudflare challenge...');
  await page.waitForTimeout(15000);
  
  let url = page.url();
  console.log(`URL after wait: ${url}`);
  
  await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-api.png' });
  
  // If we need to login
  if (!url.includes('api') || url.includes('login')) {
    console.log('Need to login first...');
    
    // Wait more
    await page.waitForTimeout(10000);
    url = page.url();
    console.log(`URL after more wait: ${url}`);
    await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-api-2.png' });
    
    // Check for login form
    const bodyText = await page.locator('body').textContent().catch(() => '');
    console.log(`Body text preview: ${bodyText.substring(0, 500)}`);
    
    // Try email login
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').count();
    if (emailInput > 0) {
      console.log('Found email input, logging in...');
      await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first().fill('b.evariste@gmail.com');
      
      const pwInputs = await page.locator('input[type="password"]').count();
      if (pwInputs > 0) {
        await page.locator('input[type="password"]').first().fill('@8.Zine_Beni-5');
        
        // Click login/continue
        const submitBtn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Continue"), button:has-text("Sign")');
        if (await submitBtn.count() > 0) {
          await submitBtn.first().click();
          await page.waitForTimeout(10000);
          console.log(`After submit: ${page.url()}`);
          await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-api-3.png' });
        }
      }
    }
  }
  
  // If we're on the API page, look for token generation
  if (url.includes('api') || url.includes('profile')) {
    console.log('On API page!');
    await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-api-page.png', fullPage: true });
    
    // Look for "Generate" or "Create" buttons
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const text = await buttons.nth(i).textContent().catch(() => '');
      if (text && (text.toLowerCase().includes('generat') || text.toLowerCase().includes('create') || text.toLowerCase().includes('new'))) {
        console.log(`Found button: "${text.trim()}"`);
      }
    }
    
    // Look for any API key/token text
    const apiText = await page.locator('body').textContent().catch(() => '');
    if (apiText.toLowerCase().includes('api') || apiText.toLowerCase().includes('token') || apiText.toLowerCase().includes('key')) {
      console.log('API-related content found on page');
    }
  }

  await browser.close();
  console.log('\nDone!');
})();
