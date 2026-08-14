import { chromium } from "playwright";
const out={}; const b=await chromium.launch({channel:'msedge'});
for (const [kind,viewport] of Object.entries({desktop:{width:1440,height:1000},mobile:{width:393,height:852}})) {
 const p=await b.newPage({viewport}); const errors=[]; p.on('console',m=>m.type()==='error'&&errors.push(m.text()));
 await p.goto('https://shop.lebon-grace.com/track',{waitUntil:'domcontentloaded'});
 const form=p.locator('main form'); await form.waitFor();
 await p.waitForFunction(()=>{const f=document.querySelector('main form');const k=f&&Object.keys(f).find(x=>x.startsWith('__reactProps$'));return !!(k&&f[k]?.onSubmit)});
 await p.getByTestId('track-order-id').fill('ord_no_such_order'); await p.getByTestId('track-phone').fill('+971501234567');
 await p.getByTestId('track-submit').click(); await p.getByTestId('track-error').waitFor();
 out[kind]={error:await p.getByTestId('track-error').innerText(),overflow:await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),consoleErrors:errors};
 await p.screenshot({path:`audits/tracker-2026-08-10/evidence/${kind}-track.png`,fullPage:true});await p.close();
}await b.close();console.log(JSON.stringify(out));
