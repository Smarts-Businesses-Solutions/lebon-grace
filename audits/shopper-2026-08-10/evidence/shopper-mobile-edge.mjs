import { chromium } from "playwright";
const BASE = "https://shop.lebon-grace.com";
const PRODUCT = "/shop/abc-jigsaw-board";
const out = { checks: {}, consoleErrors: [], requestFailures: [] };
const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on("console", m => { if (m.type() === "error") out.consoleErrors.push(m.text()); });
page.on("requestfailed", r => out.requestFailures.push({ url: r.url(), failure: r.failure()?.errorText }));
async function reset() { await page.goto(BASE,{waitUntil:"domcontentloaded"}); await page.evaluate(()=>localStorage.clear()); await page.reload({waitUntil:"domcontentloaded"}); }
async function readyProduct() { await page.goto(BASE+PRODUCT,{waitUntil:"domcontentloaded"}); await page.getByTestId("add-to-cart").waitFor(); await page.waitForFunction(()=>{const b=document.querySelector('[data-testid="add-to-cart"]'); const k=b&&Object.keys(b).find(x=>x.startsWith("__reactProps")); return Boolean(k&&b[k]?.onClick)}); }
try {
  await reset(); await readyProduct();
  out.checks.initialOverflow = await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  await page.locator('label').filter({hasText:"Engrave a name on it"}).locator('input[type="checkbox"]').check();
  await page.getByPlaceholder("e.g. Amira").fill("Amira");
  await page.screenshot({path:"audits/shopper-2026-08-10/evidence/mobile-product-engraving.png",fullPage:true});
  await page.getByTestId("add-to-cart-mobile").click();
  await page.goto(BASE+"/cart",{waitUntil:"domcontentloaded"}); await page.getByText("Order Summary").waitFor();
  const cartText=await page.locator("body").innerText();
  out.checks.mobileStickyAddPreservesEngraving=cartText.includes("Amira");
  out.checks.cartOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  await page.screenshot({path:"audits/shopper-2026-08-10/evidence/mobile-cart.png",fullPage:true});
} catch(e) { out.fatal=String(e?.stack||e); } finally { await browser.close(); }
console.log(JSON.stringify(out,null,2));
