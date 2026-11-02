"""Category tabs: IQOS is a tab (EN + AR), shows a friendly message while empty, and products added to it appear there."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ui_lib import *
from playwright.sync_api import sync_playwright

C = Checks(); s = Server(int(os.environ.get('PORT', 4314))); log = []
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        ctx = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, locale='en-US'); pg = ctx.new_page(); watch(pg, log)
        pg.add_init_script("localStorage.setItem('kv-18','yes')")
        pg.goto(s.url + '/'); pg.wait_for_selector('#grid li')
        tabs = pg.eval_on_selector_all('#tabs .tab', "els => els.map(e => e.textContent.trim().replace(/\\s+/g, ' '))")
        C.ok(any(t.startswith('IQOS') for t in tabs), 'IQOS tab is on the shop page: %s' % tabs)
        C.ok(len(tabs) == 5, 'tabs: All + 4 categories')
        pg.click('[data-cat=iqos]'); pg.wait_for_timeout(300)
        C.ok(pg.is_visible('#none') and 'Coming soon' in pg.inner_text('#none'), 'empty IQOS shows "Coming soon": ' + pg.inner_text('#none').replace('\n', ' '))
        C.ok(pg.inner_text('#title') == 'IQOS' and '0 products' in pg.inner_text('#count'), 'title and count: %s / %s' % (pg.inner_text('#title'), pg.inner_text('#count')))
        pg.screenshot(path=SHOTS + '/cat_iqos_en.png')
        # a search with no matches keeps the normal message
        pg.click('[data-cat=all]'); pg.fill('#q', 'zzzzzz'); pg.wait_for_timeout(300)
        C.ok('Nothing matches' in pg.inner_text('#none'), 'a failed search still says nothing matches')

        ctx2 = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, locale='ar'); pa = ctx2.new_page(); watch(pa, log)
        pa.add_init_script("localStorage.setItem('kv-18','yes'); localStorage.setItem('kv-lang','ar')")
        pa.goto(s.url + '/'); pa.wait_for_selector('#grid li')
        tabs = pa.eval_on_selector_all('#tabs .tab', "els => els.map(e => e.textContent.trim().replace(/\\s+/g, ' '))")
        C.ok(any(t.startswith('آيكوس') for t in tabs), 'Arabic tab: %s' % tabs)
        pa.click('[data-cat=iqos]'); pa.wait_for_timeout(300)
        C.ok('قريباً' in pa.inner_text('#none'), 'Arabic empty message: ' + pa.inner_text('#none').replace('\n', ' '))
        pa.fill('#q', 'ايكوس'); pa.wait_for_timeout(300)
        C.ok(pa.is_visible('#none'), 'searching the Arabic name finds no products yet (none added) without errors')
        pa.screenshot(path=SHOTS + '/cat_iqos_ar.png')

        print('adding an IQOS product from the admin')
        ctx3 = br.new_context(viewport={'width': 1100, 'height': 800}, locale='en-US'); ow = ctx3.new_page(); watch(ow, log)
        ow.goto(s.url + '/admin'); ow.wait_for_selector('#au-code:visible')
        ow.fill('#au-code', CODE); ow.fill('#au-user', 'rami'); ow.fill('#au-pass', 'owner-pass-1'); ow.fill('#au-pass2', 'owner-pass-1'); ow.fill('#au-name', 'Rami'); ow.click('#au-go')
        ow.wait_for_selector('#a-list .a-item'); ow.click('#a-add'); ow.wait_for_selector('.a-item.open [data-f=name]')
        item = ow.locator('.a-item.open')
        C.ok('IQOS' in item.locator('[data-f=cat]').inner_text(), 'the admin category list offers IQOS')
        item.locator('[data-f=name]').fill('IQOS Iluma One'); item.locator('[data-f=name]').dispatch_event('input')
        item.locator('[data-f=cat]').select_option('iqos'); ow.wait_for_timeout(200)
        C.ok(ow.locator('.a-item.open [data-f=sub]').count() == 0, 'no subcategory box for IQOS')
        item = ow.locator('.a-item.open')
        item.locator('[data-f=price]').fill('30'); item.locator('[data-f=price]').dispatch_event('input')
        ow.click('#a-save')
        import time
        t0 = time.time()
        while time.time() - t0 < 8 and not ow.inner_text('#a-st').startswith('Saved'): ow.wait_for_timeout(150)
        C.ok(ow.inner_text('#a-st').startswith('Saved'), 'saved: ' + ow.inner_text('#a-st'))
        saved = [p for p in s.api('/api/catalog')['products'] if p['name'] == 'IQOS Iluma One']
        C.ok(len(saved) == 1 and saved[0]['cat'] == 'iqos' and saved[0]['price'] == 30 and not saved[0].get('sub'), 'stored in the IQOS category: %s' % [(p['cat'], p['sub'], p['price']) for p in saved])
        ow.click('#a-close'); ow.wait_for_timeout(300)
        ow.click('[data-cat=iqos]'); ow.wait_for_timeout(300)
        C.ok(ow.locator('#grid li').count() == 1 and ow.is_hidden('#none') and 'IQOS Iluma One' in ow.inner_text('#grid'), 'the IQOS tab now shows the product')
        C.ok('IQOS 1' in ow.inner_text('#tabs').replace('\n', ' '), 'tab count is 1')
        ow.screenshot(path=SHOTS + '/cat_iqos_filled.png')
        br.close()
finally:
    s.stop()
errs = [l for l in log if 'ERR_TUNNEL' not in l[1] and 'fonts.g' not in l[1]]
C.ok(not errs, 'no script errors: %s' % errs[:3])
sys.exit(0 if C.done() else 1)
