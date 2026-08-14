import { chromium } from "playwright";
const BASE='https://shop.lebon-grace.com';
const out={desktop:{},mobile:{},consoleErrors:[],requestFailures:[]};
const browser=await chromium.launch({channel:'msedge'});
for (const [kind,viewport] of Object.entries({desktop:{width:1440,height:1000},mobile:{width:393,height:852}})) {
 const page=await browser.newPage({viewport});
 page.on('console',m=>{if(m.type()==='error') out.consoleErrors.push(`[${kind}] ${m.text()}`)});
 page.on('requestfailed',r=>out.requestFailures.push(`[${kind}] ${r.url()} ${r.failure()?.errorText}`));
 await page.goto(BASE+'/contact',{waitUntil:'domcontentloaded'});
 await page.locator('button[aria-label="Show contact number"]').waitFor();
 await page.waitForFunction(() => {
   const button = document.querySelector('button[aria-label="Show contact number"]');
   if (!button) return false;
   const key = Object.keys(button).find(k => k.startsWith('__reactProps$'));
   const props = key ? button[key] : null;
   return Boolean(props && props.onClick);
 });
 await page.locator('button[aria-label="Show contact number"]').click();
 await page.locator('a[href*="wa.me"]').waitFor();
 out[kind].reveal={visible:await page.locator('a[href*="wa.me"]').count(),rel:await page.locator('a[href*="wa.me"]').getAttribute('rel')};
 await page.getByPlaceholder('Your name').fill('QA Enquirer');
 await page.getByPlaceholder('you@example.com').fill('qa@example.com');
 await page.getByPlaceholder('Tell us how we can help...').fill('short');
 await page.waitForFunction(() => {
   const form = document.querySelector('main form');
   if (!form) return false;
   const key = Object.keys(form).find(k => k.startsWith('__reactProps$'));
   const props = key ? form[key] : null;
   return Boolean(props && props.onSubmit);
 });
 await page.getByRole('button',{name:'Send Message'}).click();
 await page.getByText('Message must be at least 10 characters').waitFor();
 out[kind].invalidSubmission={errorVisible:await page.getByText('Message must be at least 10 characters').isVisible(),successVisible:await page.getByText('Message Sent').count()};
 out[kind].overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 out[kind].focusedMessageOverlap=await page.evaluate(() => {
   const header=document.querySelector('header')?.getBoundingClientRect();
   const message=document.querySelector('textarea[name="message"]')?.getBoundingClientRect();
   if (!header || !message) return null;
   return Math.max(0, Math.min(header.bottom,message.bottom)-Math.max(header.top,message.top));
 });
 await page.screenshot({path:`audits/enquirer-2026-08-10/evidence/${kind}-contact.png`,fullPage:true});
 await page.close();
}
await browser.close();console.log(JSON.stringify(out));
