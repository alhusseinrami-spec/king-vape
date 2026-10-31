"""Customer ordering: the flat delivery fee is added to the total, the cart and the WhatsApp message (English and Arabic)."""
import sys, os, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ui_lib import *
from playwright.sync_api import sync_playwright

C = Checks(); s = Server(int(os.environ.get('PORT', 4313))); log = []
NOISE = ('ERR_TUNNEL_CONNECTION_FAILED', 'fonts.g')

def cart(pg, lines):
    pg.add_init_script("localStorage.setItem('kv-18','yes'); localStorage.setItem('kv-cart-v1', %r)" % json.dumps(lines))
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch()

        print('priced products only')
        ctx = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, locale='en-US'); pg = ctx.new_page(); watch(pg, log)
        cart(pg, [{'id': 'freemax-rexa-pro', 'opt': '', 'qty': 2}, {'id': 'smok-novo-gt-kit', 'opt': 'Black', 'qty': 1}])   # 3 x $35 = $105
        pg.goto(s.url + '/'); pg.wait_for_selector('#orderbar:not([hidden])')
        C.ok(pg.inner_text('#ob-tot').strip('⁦⁩') == '$109', 'order bar total includes delivery: ' + pg.inner_text('#ob-tot'))
        pg.click('#orderbar'); pg.wait_for_selector('#cart[open]'); pg.wait_for_timeout(500)
        C.ok(pg.is_visible('#t-brk'), 'cart shows the items / delivery breakdown')
        C.ok(pg.inner_text('#t-items').strip('⁦⁩') == '$105' and pg.inner_text('#t-fee').strip('⁦⁩') == '$4', 'items $105 and delivery $4: %s / %s' % (pg.inner_text('#t-items'), pg.inner_text('#t-fee')))
        C.ok(pg.inner_text('#t-sum').strip('⁦⁩') == '$109', 'cart total is $109: ' + pg.inner_text('#t-sum'))
        C.ok(not pg.is_visible('#t-pending'), 'no "priced on WhatsApp" note when every item has a price')
        pg.fill('#f-name', 'Test'); pg.wait_for_timeout(200)
        msg = urllib.parse.unquote(pg.get_attribute('#wa', 'href').split('text=')[1]).replace('⁦', '').replace('⁩', '')
        C.ok('*Items:* $105' in msg and '*Delivery:* $4' in msg and '*Total:* $109' in msg, 'WhatsApp message lists items, delivery and total')
        C.ok(pg.get_attribute('#wa', 'href').startswith('https://wa.me/96171243971?text='), 'WhatsApp link still goes to the shop number')
        pg.screenshot(path=SHOTS + '/order_cart_en.png')
        pg.click('#c-close') if pg.locator('#c-close').count() else pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)
        C.ok('$4' in pg.inner_text('.site-foot') and 'delivery' in pg.inner_text('.site-foot').lower(), 'footer explains the delivery fee')

        print('mix of priced and unpriced')
        pg2 = ctx.new_page(); watch(pg2, log)
        cart(pg2, [{'id': 'freemax-rexa-pro', 'opt': '', 'qty': 1}, {'id': 'nasty-juice-60-ml', 'opt': 'Mango Ice', 'qty': 1}])
        pg2.goto(s.url + '/'); pg2.wait_for_selector('#orderbar:not([hidden])'); pg2.click('#orderbar'); pg2.wait_for_selector('#cart[open]'); pg2.wait_for_timeout(400)
        C.ok(pg2.inner_text('#t-sum').strip('⁦⁩') == '$39 +', 'total is $35 + $4 delivery, plus the unpriced item: ' + pg2.inner_text('#t-sum'))
        C.ok(pg2.is_visible('#t-pending'), 'note says one item is priced on WhatsApp')
        pg2.fill('#f-name', 'Test'); pg2.wait_for_timeout(200)
        msg = urllib.parse.unquote(pg2.get_attribute('#wa', 'href').split('text=')[1]).replace('⁦', '').replace('⁩', '')
        C.ok('*Total:* $39 plus 1 item to be priced' in msg, 'message: ' + [l for l in msg.split('\n') if 'Total' in l][0])

        print('only unpriced products')
        pg3 = ctx.new_page(); watch(pg3, log)
        cart(pg3, [{'id': 'nasty-juice-60-ml', 'opt': 'Mango Ice', 'qty': 2}])
        pg3.goto(s.url + '/'); pg3.wait_for_selector('#orderbar:not([hidden])'); pg3.click('#orderbar'); pg3.wait_for_selector('#cart[open]'); pg3.wait_for_timeout(400)
        C.ok(pg3.inner_text('#t-sum').strip('⁦⁩') == '$4 +' and not pg3.is_visible('#t-items-row') and pg3.is_visible('#t-pending'), 'delivery alone is shown, items priced on WhatsApp: ' + pg3.inner_text('#t-sum'))

        print('empty cart')
        ctx4 = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, locale='en-US'); pg4 = ctx4.new_page(); watch(pg4, log); pg4.add_init_script("localStorage.setItem('kv-18','yes')")
        pg4.goto(s.url + '/'); pg4.wait_for_selector('#grid li')
        C.ok(pg4.is_hidden('#orderbar'), 'no order bar and no fee with an empty cart')

        print('Arabic')
        ctx5 = br.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, locale='ar'); pg5 = ctx5.new_page(); watch(pg5, log)
        pg5.add_init_script("localStorage.setItem('kv-lang','ar')"); cart(pg5, [{'id': 'freemax-rexa-pro', 'opt': '', 'qty': 1}])
        pg5.goto(s.url + '/'); pg5.wait_for_selector('#orderbar:not([hidden])'); pg5.click('#orderbar'); pg5.wait_for_selector('#cart[open]'); pg5.wait_for_timeout(500)
        C.ok('التوصيل' in pg5.inner_text('#t-brk') and pg5.inner_text('#t-sum').strip('⁦⁩') == '$39', 'Arabic cart: delivery row and $39 total: ' + pg5.inner_text('#t-brk').replace('\n', ' | '))
        pg5.fill('#f-name', 'اختبار'); pg5.wait_for_timeout(200)
        msg = urllib.parse.unquote(pg5.get_attribute('#wa', 'href').split('text=')[1]).replace('⁦', '').replace('⁩', '')
        C.ok('*التوصيل:* $4' in msg and '*المجموع:* $39' in msg, 'Arabic message has the delivery line and total: ' + ' / '.join(l for l in msg.split('\n') if '$' in l and 'x' not in l.split('$')[0][-3:]))
        pg5.screenshot(path=SHOTS + '/order_cart_ar.png')
        br.close()
finally:
    s.stop()
errs = [l for l in log if not any(n in l[1] for n in NOISE)]
C.ok(not errs, 'no script errors: %s' % errs[:3])
sys.exit(0 if C.done() else 1)
