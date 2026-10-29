#!/usr/bin/env python3
"""Builds public/index.html from the parts in this folder. Run from anywhere:  python3 src/build.py
The page carries a built-in copy of the product list (lib/seed.json) so it works even before the server answers."""
import base64, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
rd = lambda f: open(os.path.join(HERE, f), encoding='utf8').read()

logo = base64.b64encode(open(os.path.join(HERE, 'logo_sq.webp'), 'rb').read()).decode()
css = '\n'.join(rd(f) for f in ['css_base.css', 'css_sheets.css', 'css_admin.css', 'css_web.css'])
assert '/*__LOGO__*/none' in css
css = css.replace('/*__LOGO__*/none', 'url("data:image/webp;base64,%s")' % logo)

seed = json.load(open(os.path.join(ROOT, 'lib', 'seed.json'), encoding='utf8'))
data = {'v': 2, 'rev': seed['rev'], 'shop': seed['shop'], 'products': seed['products']}

body = '\n'.join(rd(f) for f in ['i18n.js', 'i18n_web.js', 'core.js', 'sheet.js', 'admin_a.js', 'admin_b.js', 'admin_web.js', 'boot.js'])
assert '</script' not in body.lower(), 'app contains a script terminator'
assert '<!--' not in body, 'app contains an html comment opener'
app = "(function(){\n'use strict';\n" + body + "\n})();"
tpl = rd('tpl.html')
assert '</script' not in tpl.lower()

js = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
icon = 'data:image/webp;base64,' + logo
doc = ('<!doctype html>\n<html lang="en" dir="ltr">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       '<title>King Vape Catalogue</title>\n'
       '<meta name="description" content="King Vape: premium e-liquids, devices and puffs. Pick your products and send the order on WhatsApp.">\n'
       '<meta name="theme-color" content="#11141a">\n'
       '<link rel="icon" type="image/png" sizes="64x64" href="/favicon.png">\n'
       '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
       '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
       '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=DM+Sans:wght@400;500;700&family=Marcellus&display=swap">\n'
       '<style>:root{color-scheme:dark}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#11141a;color:#f3efe6}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>\n'
       '<style id="css">' + css + '</style>\n</head>\n<body>\n'
       '<script type="text/html" id="tpl">' + tpl + '</script>\n'
       '<script type="application/json" id="data">' + js(data) + '</script>\n'
       '<script id="app">' + app + '</script>\n</body>\n</html>\n')
out = os.path.join(ROOT, 'public', 'index.html')
open(out, 'w', encoding='utf8').write(doc)
print(out, len(doc), 'bytes')
