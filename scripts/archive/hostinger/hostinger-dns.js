const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ 
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('1. Going to Hostinger...');
  await page.goto('https://hpanel.hostinger.com', { timeout: 60000 });
  
  // Wait for Cloudflare challenge to resolve
  console.log('   Waiting for security check...');
  await page.waitForTimeout(10000);
  
  let url = page.url();
  console.log(`   URL: ${url}`);
  await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-1.png' });

  // If redirected to login
  if (url.includes('login') || url.includes('hpanel')) {
    // Look for email/password fields
    const emailField = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').count();
    console.log(`   Email fields: ${emailField}`);
    
    if (emailField > 0) {
      console.log('2. Found login form, filling...');
      await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'b.evariste@gmail.com');
      
      const pwField = await page.locator('input[type="password"]').first();
      if (await pwField.count() > 0) {
        await pwField.fill('@8.Zine_Beni-5');
        console.log('   Password filled');
        
        // Find and click login button
        const loginBtn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")');
        console.log(`   Login buttons: ${await loginBtn.count()}`);
        if (await loginBtn.count() > 0) {
          await loginBtn.first().click();
          await page.waitForTimeout(8000);
          console.log(`   After login URL: ${page.url()}`);
          await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-2.png' });
        }
      }
    } else {
      console.log('   No login form found yet');
      const bodyText = await page.locator('body').textContent().catch(() => '');
      console.log(`   Body text: ${bodyText.substring(0, 300)}`);
    }
  }

  // If we're logged in, try to find API key or DNS settings
  url = page.url();
  if (url.includes('hpanel') && !url.includes('login')) {
    console.log('3. Logged in! Looking for API/DNS settings...');
    
    // Try to go to DNS settings
    await page.goto('https://hpanel.hostinger.com/domains/lebon-grace.com/dns', { timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-dns.png' });
    console.log(`   DNS page URL: ${page.url()}`);
  }

  await browser.close();
  console.log('\nDone!');
})();
