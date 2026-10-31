var $ = function(s){ return document.querySelector(s); };
var DATA = JSON.parse(document.getElementById('data').textContent);
var SHOP = DATA.shop, PRODUCTS = DATA.products;
var store = {
  get: function(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function(k, v){ try { localStorage.setItem(k, v); } catch (e) {} },
  del: function(k){ try { localStorage.removeItem(k); } catch (e) {} }
};
var lang = (function(){ var s = store.get('kv-lang'); if (s === 'ar' || s === 'en') return s; return /^ar/i.test(navigator.language || '') ? 'ar' : 'en'; })();
var admin = { on: false, me: null, upload: null };   /* set once the server says this visitor is a signed-in admin */
var NEW_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M10 24l12 10 10-18 10 18 12-10-3 26H13z" fill="none" stroke="#dbbd84" stroke-width="3" stroke-linejoin="round"/><path d="M13 54h38" stroke="#dbbd84" stroke-width="3" stroke-linecap="round"/></svg>');

document.body.insertAdjacentHTML('beforeend', document.getElementById('tpl').textContent);

function t(k){ var v = T[lang][k]; if (v === undefined) v = T.en[k]; return typeof v === 'function' ? v.apply(null, [].slice.call(arguments, 1)) : v; }
function pl(k, n){
  var f = PL[k][lang];
  if (lang === 'ar') return n === 1 ? f[0] : n === 2 ? f[1] : n + ' ' + (n >= 3 && n <= 10 ? f[2] : f[3]);
  return n + ' ' + (n === 1 ? f[0] : f[1]);
}
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function ltr(s){ return '⁦' + s + '⁩'; }
function money(n){ return SHOP.cur + (n % 1 ? n.toFixed(2) : n); }
function moneyH(n){ return '<bdi class="n">' + money(n) + '</bdi>'; }
function nm(p){ return lang === 'ar' && p.nameAr ? p.nameAr : p.name; }
function noteOf(p){ return (lang === 'ar' && p.noteAr) || p.note || ''; }
function catOf(id){ return CATS.filter(function(c){ return c.id === id; })[0]; }
function subOf(cat, id){ return (cat.subs || []).filter(function(s){ return s.id === id; })[0]; }
function cl(o){ return lang === 'ar' ? o.ar : o.en; }
function kindOf(p){ return p.kind === 'color' ? 'color' : p.kind === 'combo' ? 'combo' : 'flavor'; }
function isOn(p){ return p.avail !== false; }
function optOn(p, o){ return !(p.off && p.off.indexOf(o) > -1); }
function liveOpts(p){ return p.options.filter(function(o){ return optOn(p, o); }); }
function lineOf(p){ return p.specs.slice(0, 2).map(trSpec).join(lang === 'ar' ? '، ' : ', '); }

var byId = {};
function indexProducts(){
  byId = {};
  PRODUCTS.forEach(function(p){
    byId[p.id] = p;
    var c = catOf(p.cat) || { en: '', ar: '' };
    p._hay = fold([p.name, p.nameAr || '', p.sub || '', c.en, c.ar, c.alt || '', p.specs.join(' '), (isOn(p) ? liveOpts(p) : p.options).join(' ')].join(' '));
  });
}
indexProducts();
function tokens(q){ return q.split(/\s+/).filter(Boolean).map(tokNorm); }
function hit(str, tk){ var s = fold(str); return s.indexOf(tk) > -1 || (ALIAS[tk] && s.indexOf(ALIAS[tk]) > -1); }

/* ---------- state + cart */
var state = { cat: 'all', sub: 'all', q: '' };
var cart = [];   /* [{id, opt, qty}] opt is '' for products without options */
var dropped = false;
(function loadCart(){
  try {
    var raw = JSON.parse(store.get('kv-cart-v1') || '[]');
    raw.forEach(function(l){
      var p = byId[l.id];
      if (!p || !(l.qty > 0)) return;
      if (p.options.length ? p.options.indexOf(l.opt) < 0 : l.opt !== '') return;
      if (!isOn(p) || (l.opt && !optOn(p, l.opt))) { dropped = true; return; }
      cart.push({ id: l.id, opt: l.opt, qty: Math.min(99, l.qty | 0) });
    });
  } catch (e) {}
})();
function saveCart(){ store.set('kv-cart-v1', JSON.stringify(cart)); }
function qtyOf(id, opt){ for (var i = 0; i < cart.length; i++) if (cart[i].id === id && cart[i].opt === opt) return cart[i].qty; return 0; }
function qtyOfProduct(id){ return cart.reduce(function(n, l){ return n + (l.id === id ? l.qty : 0); }, 0); }
function setQty(id, opt, qty){
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === id && cart[i].opt === opt) { if (qty > 0) cart[i].qty = qty; else cart.splice(i, 1); return; }
  }
  if (qty > 0) cart.push({ id: id, opt: opt, qty: qty });
}
function totals(){
  var items = 0, priced = 0, unpriced = 0;
  cart.forEach(function(l){
    var p = byId[l.id]; items += l.qty;
    if (p.price == null) unpriced += l.qty; else priced += p.price * l.qty;
  });
  var fee = items > 0 && SHOP.delivery > 0 ? SHOP.delivery : 0;   /* flat delivery fee, added to every order */
  return { items: items, priced: priced, unpriced: unpriced, fee: fee, total: priced + fee };
}

/* ---------- catalogue */
function visible(){
  var toks = tokens(state.q);
  var out = PRODUCTS.filter(function(p){
    if (toks.length) return toks.every(function(k){ return p._hay.indexOf(k) > -1 || (ALIAS[k] && p._hay.indexOf(ALIAS[k]) > -1); });
    return (state.cat === 'all' || p.cat === state.cat) && (state.sub === 'all' || p.sub === state.sub);
  });
  return out.filter(isOn).concat(out.filter(function(p){ return !isOn(p); }));   /* sold-out products go last */
}
function renderTabs(){
  var counts = { all: PRODUCTS.length };
  PRODUCTS.forEach(function(p){ counts[p.cat] = (counts[p.cat] || 0) + 1; });
  var on = state.q ? null : state.cat;   /* while searching, no tab is selected: results span every category */
  var html = '<button class="tab" type="button" data-cat="all" aria-pressed="' + (on === 'all') + '">' + t('all') + ' <span class="ct">' + counts.all + '</span></button>';
  CATS.forEach(function(c){
    html += '<button class="tab" type="button" data-cat="' + c.id + '" aria-pressed="' + (on === c.id) + '">' + cl(c) +
      (lang === 'en' && c.alt ? ' <span class="ar" lang="ar">' + c.alt + '</span>' : '') + ' <span class="ct">' + (counts[c.id] || 0) + '</span></button>';
  });
  $('#tabs').innerHTML = html;
  var cat = catOf(state.cat), subs = $('#subs');
  if (cat && cat.subs.length && !state.q) {
    var sc = {}; PRODUCTS.forEach(function(p){ if (p.cat === cat.id) sc[p.sub] = (sc[p.sub] || 0) + 1; });
    var h = '<button class="chip" type="button" data-sub="all" aria-pressed="' + (state.sub === 'all') + '">' + esc(t('allOf', cl(cat))) + '</button>';
    cat.subs.forEach(function(s){ h += '<button class="chip" type="button" data-sub="' + esc(s.id) + '" aria-pressed="' + (state.sub === s.id) + '">' + esc(cl(s)) + ' (' + (sc[s.id] || 0) + ')</button>'; });
    subs.innerHTML = h; subs.hidden = false;
  } else { subs.hidden = true; subs.innerHTML = ''; }
}
function renderGrid(){
  var list = visible(), toks = tokens(state.q), cat = catOf(state.cat);
  var sub = cat && state.sub !== 'all' ? subOf(cat, state.sub) : null;
  $('#title').textContent = state.q ? t('resultsFor', state.q.trim()) : state.cat === 'all' ? t('allProducts') : sub ? cl(sub) : cl(cat);
  $('#count').textContent = pl('product', list.length);
  $('#intro').hidden = !(state.cat === 'all' && !state.q);
  $('#none').hidden = list.length > 0;
  $('#grid').innerHTML = list.map(function(p){
    var live = liveOpts(p), n = live.length, off = !isOn(p);
    var badge = n && !off ? '<span class="badge">' + pl(kindOf(p), n) + '</span>' : '';
    var inq = qtyOfProduct(p.id), hitTxt = '';
    if (toks.length && n && !off) {
      var hits = live.filter(function(o){ return toks.every(function(k){ return hit(o, k); }); });
      if (hits.length && hits.length < n) hitTxt = '<span class="hit">' + esc(hits.slice(0, 2).join(', ')) + (hits.length > 2 ? ' +' + (hits.length - 2) : '') + '</span>';
    }
    return '<li><button class="card' + (off ? ' off' : '') + '" type="button" data-id="' + esc(p.id) + '" style="--glow:rgb(' + p.glow.join(',') + ')">' +
      '<span class="media"><img src="' + esc(p.img) + '" alt="' + esc(nm(p)) + '" loading="lazy" decoding="async">' + badge +
      (off ? '<span class="soldtag">' + t('soldOut') + '</span>' : '') + (inq ? '<span class="inorder">' + t('inOrder', inq) + '</span>' : '') + '</span>' +
      '<span class="info"><span class="name">' + esc(nm(p)) + '</span><span class="line">' + esc(lineOf(p)) + '</span>' + hitTxt +
      '<span class="foot">' + (p.price != null ? '<span class="price">' + moneyH(p.price) + '</span>' : '<span class="ask">' + t('askPrice') + '</span>') + '</span></span></button></li>';
  }).join('');
}
function totalText(tt){ return tt.total > 0 ? ltr(money(tt.total) + (tt.unpriced ? ' +' : '')) : (tt.items ? t('askPrice') : ''); }
function renderBars(){
  var tt = totals();
  var n = $('#cartn'); n.textContent = tt.items; n.hidden = !tt.items;
  var ob = $('#orderbar'); ob.hidden = !tt.items;
  $('#ob-text').textContent = t('viewOrder', pl('item', tt.items));
  $('#ob-tot').textContent = totalText(tt);
}
function render(){ renderTabs(); renderGrid(); renderBars(); }

/* ---------- live catalogue: the page ships with a built-in list, then the server's newest list replaces it */
var lastCatalog = 0;
function normProduct(p){
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !catOf(p.cat)) return null;
  var q = {}, k;
  for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) q[k] = p[k];
  q.options = Array.isArray(p.options) ? p.options.filter(function(o){ return typeof o === 'string'; }) : [];
  q.specs = Array.isArray(p.specs) ? p.specs.filter(function(o){ return typeof o === 'string'; }) : [];
  q.off = Array.isArray(p.off) ? p.off.filter(function(o){ return q.options.indexOf(o) > -1; }) : undefined;
  if (!q.off || !q.off.length) delete q.off;
  q.glow = Array.isArray(p.glow) && p.glow.length === 3 ? p.glow : [120, 110, 90];
  q.price = typeof p.price === 'number' ? p.price : null;
  q.img = p.img || NEW_IMG;
  q.sub = p.sub || null;
  return q;
}
function pruneCart(){
  var before = cart.length;
  cart = cart.filter(function(l){
    var p = byId[l.id];
    if (!p) return false;
    if (p.options.length ? p.options.indexOf(l.opt) < 0 : l.opt !== '') return false;
    return isOn(p) && !(l.opt && !optOn(p, l.opt));
  });
  if (cart.length !== before) saveCart();
  return cart.length !== before;
}
function applyCatalog(cat, force){
  if (!cat || !Array.isArray(cat.products)) return false;
  if (!force && DATA.rev === cat.rev) return false;
  var list = cat.products.map(normProduct).filter(Boolean);
  PRODUCTS.length = 0; list.forEach(function(p){ PRODUCTS.push(p); });
  DATA.rev = cat.rev; lastCatalog = Date.now(); indexProducts();
  var lost = pruneCart();
  render();
  if ($('#cart').open) renderCart();
  if (lost) toast(t('tDropped'), true);
  return true;
}
function fetchCatalog(){
  lastCatalog = Date.now();
  return fetch('/api/catalog', { cache: 'no-cache', headers: { accept: 'application/json' } }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

var toastTimer;
function toast(msg, bad){
  var el = $('#toast'); el.textContent = msg; el.hidden = false; el.classList.toggle('bad', !!bad);
  clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.hidden = true; }, bad ? 4200 : 2200);
}

/* ---------- dialogs */
/* Safari/iOS can collapse a flex scroll area inside an auto-height bottom sheet to 0px (only the photo shows).
   If that happens, give the sheet a definite height, which every engine resolves the same way. */
function fitSheet(d){
  d.style.height = '';
  var sc = d.querySelector('.s-scroll, .c-scroll, .a-list');
  if (!sc || !d.open) return;
  if (sc.clientHeight < 90 && sc.scrollHeight > sc.clientHeight + 16) d.style.height = Math.round(window.innerHeight * 0.92) + 'px';
}
function openD(d){
  if (!d.open) d.showModal();
  document.documentElement.classList.add('lock');
  if (d.classList.contains('sheet')) requestAnimationFrame(function(){ fitSheet(d); });
}
function closeD(d){ if (d.open) d.close(); }
['sheet', 'cart'].forEach(function(id){
  var d = $('#' + id);
  d.addEventListener('click', function(e){ if (e.target === d) d.close(); });
});
document.querySelectorAll('dialog').forEach(function(d){
  d.addEventListener('close', function(){ d.style.height = ''; if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('lock'); });
});
