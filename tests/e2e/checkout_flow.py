"""
End-to-end checkout against the live site, in Stripe TEST mode.

Uses launch(channel="chrome"), which starts a NEW Chrome process with a
throwaway profile. It never touches an already-running browser: that would
require connect_over_cdp or launch_persistent_context against the real profile,
neither of which is used here.

Waits on conditions throughout, never on fixed sleeps.
"""
import sys, time, json
from playwright.sync_api import sync_playwright, expect

BASE = "https://shop.lebon-grace.com"
SLUG = "abc-jigsaw-board"
STAMP = str(int(time.time()))
EMAIL = f"e2e-{STAMP}@example.com"
PHONE = "0501234567"

results = []
def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    ctx = browser.new_context(viewport={"width": 1400, "height": 1000})
    page = ctx.new_page()
    page.set_default_timeout(30000)

    # 1. Product page loads and shows the real price
    page.goto(f"{BASE}/shop/{SLUG}", wait_until="domcontentloaded")
    page.wait_for_function("() => document.body.innerText.includes('AED')")
    body = page.inner_text("body")
    check("product page shows AED 15", "AED 15" in body)
    # Precondition for the negative check below: prove the page really rendered
    check("product page rendered (has product name)", "Jigsaw" in body or "ABC" in body.upper())
    check("no fabricated discount on product page",
          "Save AED" not in body, "would indicate the false reference price returned")

    # 2. Add to cart
    #
    # Wait for the button to be HYDRATED, not merely present. The server sends
    # the markup, so the element exists long before React attaches handlers;
    # clicking in that window does nothing at all and looks exactly like a
    # broken Add to Cart. The condition is the onClick prop on the React fiber.
    page.wait_for_function(
        """() => { const b=[...document.querySelectorAll('button')]
                     .find(x=>/add to cart/i.test(x.textContent));
                   if(!b) return false;
                   const k=Object.keys(b).find(k=>k.startsWith('__reactProps'));
                   return !!(k && b[k].onClick); }""",
        timeout=30000,
    )
    page.get_by_role("button", name="Add to Cart").first.click()
    page.wait_for_function(
        "() => (localStorage.getItem('lebon-grace-cart')||'').includes('%s')" % SLUG
    )
    check("item added to cart", True)

    # 3. Cart shows correct delivery maths
    page.goto(f"{BASE}/cart", wait_until="domcontentloaded")
    page.wait_for_function("() => document.body.innerText.includes('Order Summary')")
    cart = page.inner_text("body")
    check("cart shows the item and a correct pickup total",
          "AED 15" in cart and "Pickup" in cart and "over AED 300" not in cart,
          "pickup is default so no delivery threshold renders; AED 300 was the stale value")
    check("cart no longer shows the dead 'Pay on delivery' split",
          "Pay on delivery" not in cart)

    # 4. Checkout form
    page.goto(f"{BASE}/checkout", wait_until="domcontentloaded")
    page.wait_for_function(
        """() => { const i=document.querySelector('input[name="email"]'); if(!i) return false;
                   const k=Object.keys(i).find(k=>k.startsWith('__reactProps'));
                   return !!(k && i[k].onChange); }""")
    co = page.inner_text("body")
    check("Cash on Delivery option removed", "Cash on Delivery" not in co,
          "it never worked: paymentMethod is ignored by the API")
    check("consent text no longer claims orders are final",
          "no cancellations or refunds" not in co)

    page.fill('input[name="email"]', EMAIL)
    page.fill('input[name="phone"]', PHONE)
    page.fill('input[name="firstName"]', "E2E")
    page.fill('input[name="lastName"]', "Test")
    # No address fields on the pickup path, which is the default. Their absence
    # here is the point: they used to be required by validate() while hidden.
    check("name fields render on the pickup path",
          page.locator("input[name='firstName']").count() > 0,
          "were delivery-only while validate() always required them")
    page.check('input[name="termsAccepted"]')

    # 5. Submit -> Stripe
    page.get_by_role("button", name.__class__ and "Pay").first.click() if False else \
        page.click('button[type="submit"]')
    page.wait_for_url("**checkout.stripe.com/**", timeout=45000)
    check("redirected to Stripe Checkout", "checkout.stripe.com" in page.url)

    check("Stripe session is TEST mode",
          "/test/" in page.url or "test" in page.url,
          f"url={page.url[:80]}")

    # 6. Pay with the standard test card
    page.wait_for_function("() => document.querySelector('input#cardNumber')")
    # Stripe still shows an email field; it is prefilled from customer_email now,
    # so assert that rather than retyping it.
    prefilled = page.input_value("input#email") if page.locator("input#email").count() else ""
    check("Stripe prefills the email we already collected", EMAIL.lower() in prefilled.lower(),
          f"got {prefilled!r}")
    page.fill('input#cardNumber, input[name="cardNumber"]', "4242424242424242")
    page.fill('input#cardExpiry, input[name="cardExpiry"]', "12/34")
    page.fill('input#cardCvc, input[name="cardCvc"]', "123")
    try:
        page.fill('input#billingName, input[name="billingName"]', "E2E Test")
    except Exception:
        pass
    try:
        page.select_option('select#billingCountry, select[name="billingCountry"]', "AE")
    except Exception:
        pass

    page.click('button[type="submit"], .SubmitButton')
    page.wait_for_function("() => !/processing/i.test(document.querySelector('button[type=\"submit\"]')?.textContent||'') || location.host!=='checkout.stripe.com'", timeout=60000)
    page.wait_for_url("**shop.lebon-grace.com/checkout**success=true**", timeout=90000)
    check("returned to success page", "success=true" in page.url)
    sid = ""
    if "session_id=" in page.url:
        sid = page.url.split("session_id=")[1].split("&")[0]
    check("success url carries a session id", bool(sid), sid[:24])

    page.wait_for_function("() => document.body.innerText.length > 100")
    print(json.dumps({"session_id": sid, "email": EMAIL}))

    ctx.close(); browser.close()

print()
failed = [r for r in results if not r[1]]
print(f"  {len(results)-len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
