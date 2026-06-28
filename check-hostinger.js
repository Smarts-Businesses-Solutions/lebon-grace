const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Going to Hostinger hPanel...');
  await page.goto('https://hpanel.hostinger.com', { timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const url = page.url();
  console.log(`URL: ${url}`);
  
  // Screenshot
  await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-login.png' });
  console.log('Screenshot saved');

  // Check for login form
  const emailField = await page.locator('input[type="email"], input[name="email"], #email').count();
  const passwordField = await page.locator('input[type="password"], input[name="password"], #password').count();
  console.log(`Email field: ${emailField}, Password field: ${passwordField}`);

  // Try login
  if (emailField > 0 && passwordField > 0) {
    console.log('2. Logging in...');
    await page.fill('input[type="email"], input[name="email"], #email', 'b.evariste@gmail.com');
    await page.fill('input[type="password"], input[name="password"], #password', '@8.Zine_Beni-5');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(8000);
    
    console.log(`After login URL: ${page.url()}`);
    await page.screenshot({ path: 'C:/Users/user/Desktop/aprojects/lebon-grace/screenshots/hostinger-after-login.png' });
  } else {
    console.log('Login form not found');
    const bodyText = await page.locator('body').textContent().catch(() => '');
    console.log(`Page text: ${bodyText.substring(0, 500)}`);
  }

  await browser.close();
  console.log('Done!');
})();
