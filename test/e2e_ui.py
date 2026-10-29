"""Drives the real page in a browser against the local server: setup, sign-in, editing, photos, admins, conflicts, Arabic."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ui_lib import *
from playwright.sync_api import sync_playwright

C = Checks()
s = Server(int(os.environ.get('PORT', 4311)))
log = []
NOISE = ('ERR_TUNNEL_CONNECTION_FAILED', 'fonts.g', 'Failed to load resource: the server responded with a status of 4', 'net::ERR_ABORTED')

def gate(pg):
    pg.wait_for_selector('#grid li')
    if pg.evaluate("document.getElementById('gate').open"):
        pg.click('#g-yes'); pg.wait_for_timeout(150)

def settle(pg, ms=250): pg.wait_for_timeout(ms)

def wait_js(pg, expr, timeout=8000):
    """Poll an expression from the test side. (Playwright's own wait_for_function evals a string, which the page's CSP rightly forbids.)"""
    import time
    t0 = time.time(); last = None
    while (time.time() - t0) * 1000 < timeout:
        try: last = pg.evaluate(expr)
        except Exception as e: last = str(e)
        if last is True: return
        pg.wait_for_timeout(60)
    raise AssertionError('timed out waiting for %s (last: %r)' % (expr, last))

def sign_in(pg, user, pw):
    pg.click('#staff'); pg.wait_for_selector('#auth[open]')
    wait_js(pg, "document.getElementById('au-title').textContent.length>0")
    pg.fill('#au-user', user); pg.fill('#au-pass', pw); pg.click('#au-go')

try:
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        ctx = br.new_context(viewport={'width': 1100, 'height': 820}, locale='en-US')
        owner = ctx.new_page(); watch(owner, log)
        owner.goto(s.url + '/'); gate(owner)

        print('customer view')
        C.ok(owner.locator('#grid li').count() == 44, '44 products on the shop page')
        C.ok(owner.locator('#adminbtn').is_hidden(), 'no Admin button for a visitor')
        C.ok(owner.locator('#s-edit').is_hidden(), 'no edit link for a visitor')
        C.ok(owner.locator('#staff').is_visible(), 'a small Staff sign-in link in the footer')

        print('first-time setup')
        owner.click('#staff'); owner.wait_for_selector('#auth[open]')
        owner.wait_for_selector('#au-code:visible')
        C.ok(owner.locator('#au-title').inner_text() == 'Set up the owner account', 'shows the owner setup form while there is no admin')
        owner.screenshot(path=SHOTS + '/web_setup.png')
        owner.fill('#au-code', 'WRONG-CODE'); owner.fill('#au-user', 'rami'); owner.fill('#au-pass', 'owner-pass-1'); owner.fill('#au-pass2', 'owner-pass-1'); owner.click('#au-go')
        owner.wait_for_selector('#au-msg:visible')
        C.ok('setup code' in owner.inner_text('#au-msg').lower(), 'wrong setup code is explained: ' + owner.inner_text('#au-msg'))
        owner.fill('#au-code', CODE); owner.fill('#au-pass2', 'different-pass'); owner.click('#au-go')
        C.ok('do not match' in owner.inner_text('#au-msg'), 'mismatched passwords are caught before sending')
        owner.fill('#au-pass', 'short'); owner.fill('#au-pass2', 'short'); owner.click('#au-go'); settle(owner, 400)
        C.ok('at least 8' in owner.inner_text('#au-msg'), 'a short password is explained')
        owner.fill('#au-pass', 'owner-pass-1'); owner.fill('#au-pass2', 'owner-pass-1'); owner.fill('#au-name', 'Rami')
        owner.click('#au-go')
        owner.wait_for_selector('#admin[open]')
        owner.wait_for_selector('#a-list .a-item')
        C.ok(owner.locator('#auth').evaluate('d => d.open') is False, 'sign-in dialog closes')
        C.ok(owner.locator('#a-list .a-item').count() == 44, 'admin list shows all 44 products')
        C.ok('Signed in as Rami' in owner.inner_text('#a-sub') and 'Owner' in owner.inner_text('#a-sub'), 'header says who is signed in: ' + owner.inner_text('#a-sub'))
        C.ok(owner.inner_text('#a-people') == 'Admins', 'owner sees the Admins button')
        owner.screenshot(path=SHOTS + '/web_admin_owner.png')

        print('edit and save')
        first = owner.locator('#a-list .a-item').first
        pid = first.get_attribute('data-id')
        pname = first.locator('.a-main b').inner_text()
        first.locator('[data-act=avail]').click()                       # mark the whole product sold out
        C.ok(owner.inner_text('#a-save') == 'Save changes (1)', 'save button counts the change')
        # open a different product with flavors and switch one flavor off
        item = owner.locator('.a-item[data-id="airmez-20000"]')
        item.locator('[data-act=toggle]').click()
        n_opts = item.locator('.a-opt').count()
        item.locator('.a-opt').nth(1).locator('[data-act=optsw]').click()
        flavor_off = item.locator('.a-opt').nth(1).locator('input').input_value()
        item.locator('[data-f=price]').fill('11.5'); item.locator('[data-f=price]').dispatch_event('input')
        C.ok(n_opts > 2, 'product has flavors to switch (%d)' % n_opts)
        owner.click('#a-save'); wait_js(owner, "document.getElementById('a-st').textContent.startsWith('Saved')")
        cat = s.api('/api/catalog')
        got = {p['id']: p for p in cat['products']}
        C.ok(cat['rev'] == 2, 'catalogue revision went 1 -> 2')
        C.ok(got[pid].get('avail') is False, 'product marked sold out is stored')
        C.ok(got['airmez-20000']['off'] == [flavor_off] and got['airmez-20000']['price'] == 11.5, 'flavor off + price stored (%s)' % flavor_off)
        C.ok(owner.inner_text('#a-save') == 'Save changes', 'dirty count cleared after saving')
        owner.click('#a-close'); settle(owner)
        C.ok(owner.locator('.card.off').count() == 1, 'shop page already shows the sold-out product (no reload)')

        print('photo upload')
        owner.click('#adminbtn'); owner.wait_for_selector('#admin[open]')
        owner.fill('#a-q', 'airfuze'); settle(owner)
        it = owner.locator('.a-item').first; it.locator('[data-act=toggle]').click()
        it.locator('input[data-f=photo]').set_input_files(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'photo_test.png'))
        wait_js(owner, "document.querySelector('.a-item.open .a-photo img').src.includes('/api/photo')", 8000)
        src = owner.evaluate("document.querySelector('.a-item.open .a-photo img').getAttribute('src')")
        C.ok(src.startswith('/api/photo?i='), 'photo upload returns a site address: ' + src)
        owner.click('#a-save'); wait_js(owner, "document.getElementById('a-st').textContent.startsWith('Saved')")
        stored = {p['id']: p for p in s.api('/api/catalog')['products']}['airfuze-smart-40000']['img']
        C.ok(stored == src, 'the saved product points at the uploaded photo: ' + stored)
        owner.click('#a-close'); settle(owner)
        owner.reload(); gate(owner)
        wait_js(owner, "document.querySelectorAll('#grid img[src^=\"/api/photo\"]').length > 0", 8000)   # the live list replaces the built-in one a moment after load
        owner.locator('#grid img[src^="/api/photo"]').first.scroll_into_view_if_needed()
        wait_js(owner, "Array.from(document.querySelectorAll('#grid img[src^=\"/api/photo\"]')).every(i => i.complete && i.naturalWidth > 0)", 8000)
        loaded = owner.evaluate("Array.from(document.querySelectorAll('#grid img')).filter(i => i.getAttribute('src').startsWith('/api/photo')).map(i => i.complete && i.naturalWidth > 0)")
        C.ok(loaded == [True], 'uploaded photo shows on a fresh page load: %s' % loaded)
        C.ok(owner.locator('#adminbtn').is_visible(), 'after a reload the owner is still recognised (Admin button back)')

        print('admins')
        owner.click('#adminbtn'); owner.wait_for_selector('#admin[open]'); owner.click('#a-people'); owner.wait_for_selector('#people[open]')
        owner.wait_for_selector('#pe-list .p-row')
        C.ok(owner.locator('#pe-list .p-row').count() == 1, 'admin list starts with just the owner')
        owner.screenshot(path=SHOTS + '/web_people_owner.png')
        owner.click('[data-act=gen][data-for=ad-pass]')
        gen = owner.input_value('#ad-pass')
        C.ok(len(gen) == 14 and gen.count('-') == 2, 'generated password is readable: ' + gen)
        owner.fill('#ad-user', 'Sara'); owner.fill('#ad-name', 'Sara'); owner.click('#pe-body form[data-form=add] [type=submit]')
        owner.wait_for_selector('#pe-cred:visible')
        cred = owner.inner_text('#pe-cred pre')
        C.ok('Username: sara' in cred and ('Password: ' + gen) in cred and '/admin' in cred, 'login details are shown once to share')
        C.ok(owner.locator('#pe-list .p-row').count() == 2, 'new admin listed')
        settle(owner, 400); owner.screenshot(path=SHOTS + '/web_people_added.png')
        owner.fill('#ad-user', 'sara'); owner.fill('#ad-pass', 'abcdefghij'); owner.click('#pe-body form[data-form=add] [type=submit]'); settle(owner, 400)
        C.ok('already used' in owner.inner_text('#pe-msg'), 'duplicate username explained: ' + owner.inner_text('#pe-msg'))
        owner.fill('#ad-user', 'x y'); owner.click('#pe-body form[data-form=add] [type=submit]'); settle(owner, 400)
        C.ok('Username:' in owner.inner_text('#pe-msg'), 'bad username explained')

        # a second person signs in on another device
        ctx2 = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True, device_scale_factor=2, locale='en-US')
        sara = ctx2.new_page(); watch(sara, log)
        sara.goto(s.url + '/admin'); sara.wait_for_selector('#auth[open]')
        wait_js(sara, "document.getElementById('au-title').textContent.length>0")
        C.ok(sara.inner_text('#au-title') == 'Staff sign-in', '/admin goes straight to the sign-in (no age gate in the way)')
        sara.fill('#au-user', 'sara'); sara.fill('#au-pass', 'wrong-wrong-1'); sara.click('#au-go'); sara.wait_for_selector('#au-msg:visible')
        C.ok(sara.inner_text('#au-msg') == 'Wrong username or password.', 'wrong password message')
        sara.screenshot(path=SHOTS + '/web_login_mobile.png')
        sara.fill('#au-pass', gen); sara.click('#au-go'); sara.wait_for_selector('#admin[open]'); sara.wait_for_selector('#a-list .a-item')
        C.ok(sara.inner_text('#a-people') == 'My account', 'an admin sees My account, not Admins')
        settle(sara, 600); sara.screenshot(path=SHOTS + '/web_admin_mobile.png')
        sara.click('#a-people'); sara.wait_for_selector('#people[open]')
        C.ok(sara.locator('#pe-list').count() == 0 and sara.locator('#ad-user').count() == 0, 'an admin cannot see the admin list or add form')
        sara.screenshot(path=SHOTS + '/web_people_admin_mobile.png')
        sara.click('#pe-close')

        print('two people editing at once')
        # both open the same product; sara saves first
        sara.fill('#a-q', 'airmez fox'); settle(sara)
        owner.click('#pe-close'); settle(owner)
        owner.fill('#a-q', 'airmez fox'); settle(owner)
        sit = sara.locator('.a-item').first; sit.locator('[data-act=toggle]').click(); sit.locator('[data-f=price]').fill('21'); sit.locator('[data-f=price]').dispatch_event('input')
        oit = owner.locator('.a-item').first; oit.locator('[data-act=toggle]').click(); oit.locator('[data-f=price]').fill('22'); oit.locator('[data-f=price]').dispatch_event('input')
        # the owner also changes another product, which should survive
        owner.fill('#a-q', ''); settle(owner)
        o2 = owner.locator('.a-item[data-id="airbar-shisha-5000"]'); o2.locator('[data-act=avail]').click()
        sara.click('#a-save'); wait_js(sara, "document.getElementById('a-st').textContent.startsWith('Saved')")
        owner.click('#a-save'); owner.wait_for_selector('#a-banner:visible')
        C.ok('Someone else changed' in owner.inner_text('#a-banner'), 'conflict explained to the second editor: ' + owner.inner_text('#a-banner')[:90])
        cat = s.api('/api/catalog'); got = {p['id']: p for p in cat['products']}
        C.ok(got['airmez-fox-120000']['price'] == 21, "first editor's price is kept (21)")
        C.ok(owner.inner_text('#a-save') == 'Save changes (1)', 'the second editor keeps their other change waiting')
        owner.click('#a-save'); wait_js(owner, "document.getElementById('a-st').textContent.startsWith('Saved')")
        got = {p['id']: p for p in s.api('/api/catalog')['products']}
        C.ok(got['airbar-shisha-5000'].get('avail') is False and got['airmez-fox-120000']['price'] == 21, 'second save lands without overwriting the first')
        owner.screenshot(path=SHOTS + '/web_conflict.png')

        print('customer in a third browser')
        ctx3 = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, locale='en-US')
        cust = ctx3.new_page(); watch(cust, log)
        final = s.api('/api/catalog')['products']
        sold = [p['id'] for p in final if p.get('avail') is False or (p['options'] and all(o in p.get('off', []) for o in p['options']))]
        keep = [p for p in final if p['options'] and p['id'] not in sold and p['options'][0] not in p.get('off', [])][0]
        cust.add_init_script("localStorage.setItem('kv-18','yes'); localStorage.setItem('kv-cart-v1', JSON.stringify([{id:'airbar-shisha-5000', opt:%s, qty:1},{id:%s, opt:%s, qty:1}]))" % (json.dumps(([p for p in final if p['id'] == 'airbar-shisha-5000'][0]['options'] or [''])[0]), json.dumps(keep['id']), json.dumps(keep['options'][0])))
        cust.goto(s.url + '/'); cust.wait_for_selector('#grid li')
        wait_js(cust, "document.querySelectorAll('.card.off').length == %d" % len(sold), 8000)
        C.ok(cust.locator('.card.off').count() == len(sold) and len(sold) >= 2, 'a customer sees the %d sold-out products (%d)' % (len(sold), cust.locator('.card.off').count()))
        wait_js(cust, "JSON.parse(localStorage.getItem('kv-cart-v1')).length == 1", 6000)
        cart = cust.evaluate("JSON.parse(localStorage.getItem('kv-cart-v1')).map(l => l.id)")
        C.ok('airbar-shisha-5000' not in cart and keep['id'] in cart, 'a sold-out product is dropped from an old cart, an available one stays: %s' % cart)
        C.ok(cust.locator('#adminbtn').is_hidden() and cust.locator('#s-edit').is_hidden(), 'customer still has no admin controls')
        cust.screenshot(path=SHOTS + '/web_customer_mobile.png')

        print('removing an admin / resetting a password')
        owner.click('#a-close'); settle(owner); owner.click('#adminbtn'); owner.wait_for_selector('#admin[open]'); owner.click('#a-people'); owner.wait_for_selector('#pe-list .p-row')
        owner.locator('.p-row[data-u=sara] [data-act=reset]').click()
        owner.fill('#rp-sara', 'brand-new-pass-1'); owner.locator('.p-row[data-u=sara] form [type=submit]').click(); owner.wait_for_selector('#pe-cred:visible')
        C.ok('brand-new-pass-1' in owner.inner_text('#pe-cred pre'), 'reset password is shown to share')
        sara.click('#a-save') if False else None
        r = sara.evaluate("fetch('/api/admin?a=catalog').then(r => r.status)")
        C.ok(r == 401, "sara's open session was signed out by the reset (status %s)" % r)
        owner.locator('.p-row[data-u=sara] [data-act=remove]').click(); owner.locator('.p-row[data-u=sara] [data-act=remove]').click()
        wait_js(owner, "document.querySelectorAll('#pe-list .p-row').length === 1")
        C.ok(True, 'admin removed after a second tap')

        print('change my own password')
        owner.click('.p-pw summary'); owner.fill('#pw-cur', 'owner-pass-1'); owner.fill('#pw-new', 'owner-pass-2'); owner.fill('#pw-new2', 'owner-pass-3')
        owner.click('form[data-form=pw] [type=submit]'); settle(owner, 300)
        C.ok('do not match' in owner.inner_text('#pe-msg'), 'mismatch caught')
        owner.fill('#pw-cur', 'wrong-current-1'); owner.fill('#pw-new2', 'owner-pass-2'); owner.click('form[data-form=pw] [type=submit]'); settle(owner, 500)
        C.ok('current password is wrong' in owner.inner_text('#pe-msg'), 'wrong current password explained: ' + owner.inner_text('#pe-msg'))
        owner.fill('#pw-cur', 'owner-pass-1'); owner.click('form[data-form=pw] [type=submit]'); wait_js(owner, "document.getElementById('pe-msg').textContent.startsWith('Password changed')")
        C.ok(owner.evaluate("fetch('/api/admin?a=catalog').then(r => r.status)") == 200, 'this device stays signed in after the change')

        print('sign out')
        owner.click('#pe-close'); settle(owner); owner.click('#a-out'); settle(owner, 500)
        C.ok(owner.locator('#adminbtn').is_hidden() and owner.evaluate("document.getElementById('admin').open") is False, 'signed out: panel closed, Admin button gone')
        C.ok(owner.evaluate("fetch('/api/admin?a=catalog').then(r => r.status)") == 401, 'server agrees the session is over')

        print('Arabic')
        ar = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True, device_scale_factor=2, locale='ar')
        ap = ar.new_page(); watch(ap, log)
        ap.add_init_script("localStorage.setItem('kv-18','yes'); localStorage.setItem('kv-lang','ar')")
        ap.goto(s.url + '/'); ap.wait_for_selector('#grid li'); settle(ap, 400)
        ap.click('#staff'); ap.wait_for_selector('#auth[open]'); wait_js(ap, "document.getElementById('au-title').textContent.length>0")
        C.ok(ap.inner_text('#au-title') == 'دخول الفريق' and ap.evaluate("document.documentElement.dir") == 'rtl', 'sign-in is in Arabic and right-to-left')
        ap.screenshot(path=SHOTS + '/web_login_ar.png')
        ap.fill('#au-user', 'rami'); ap.fill('#au-pass', 'owner-pass-2'); ap.click('#au-go'); ap.wait_for_selector('#admin[open]'); ap.wait_for_selector('#a-list .a-item')
        ap.screenshot(path=SHOTS + '/web_admin_ar.png')
        ap.click('#a-people'); ap.wait_for_selector('#pe-list .p-row'); settle(ap, 200)
        settle(ap, 400); ap.screenshot(path=SHOTS + '/web_people_ar.png')
        C.ok('المسؤولون' in ap.inner_text('#pe-body'), 'admins screen is in Arabic')
        # lock-out after repeated wrong passwords
        lk = br.new_context(locale='en-US'); lp = lk.new_page(); watch(lp, log); lp.goto(s.url + '/'); gate(lp)
        for i in range(7):
            lp.click('#staff') if not lp.evaluate("document.getElementById('auth').open") else None
            lp.wait_for_selector('#auth[open]'); wait_js(lp, "document.getElementById('au-title').textContent.length>0")
            lp.fill('#au-user', 'rami'); lp.fill('#au-pass', 'wrong-pass-%d' % i); lp.click('#au-go'); wait_js(lp, "!document.getElementById('au-go').disabled"); settle(lp, 80)
        C.ok('Too many wrong tries' in lp.inner_text('#au-msg'), 'repeated wrong passwords lock sign-in: ' + lp.inner_text('#au-msg'))
        br.close()
finally:
    s.stop()

errs = [l for l in log if not any(n in l[1] for n in NOISE)]
C.ok(not errs, 'no script errors or blocked requests in any page: %s' % errs[:5])
sys.exit(0 if C.done() else 1)
