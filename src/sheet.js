
/* ---------- search, tabs, language */
$('#tabs').addEventListener('click', function(e){
  var b = e.target.closest('[data-cat]'); if (!b) return;
  state.cat = b.dataset.cat; state.sub = 'all'; state.q = ''; $('#q').value = ''; render();
});
$('#subs').addEventListener('click', function(e){
  var b = e.target.closest('[data-sub]'); if (!b) return;
  state.sub = b.dataset.sub; render();
});
$('#q').addEventListener('input', function(e){ state.q = e.target.value; renderTabs(); renderGrid(); });
$('#grid').addEventListener('click', function(e){
  var b = e.target.closest('[data-id]'); if (b) openProduct(b.dataset.id);
});
function applyLang(){
  var h = document.documentElement;
  h.lang = lang; h.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i]').forEach(function(el){ el.textContent = t(el.dataset.i); });
  document.querySelectorAll('[data-i-ph]').forEach(function(el){ el.placeholder = t(el.dataset.iPh); });
  document.querySelectorAll('[data-i-aria]').forEach(function(el){ el.setAttribute('aria-label', t(el.dataset.iAria)); });
  var other = lang === 'ar' ? 'English' : 'عربي';
  [$('#langbtn'), $('#g-lang')].forEach(function(b){ b.textContent = other; b.lang = lang === 'ar' ? 'en' : 'ar'; b.setAttribute('aria-label', t('switchTo')); });
  var fd = $('#foot-del'); fd.hidden = !(SHOP.delivery > 0); fd.textContent = SHOP.delivery > 0 ? t('footDelivery', ltr(money(SHOP.delivery))) : '';
  $('#c-clear').textContent = t('clear'); delete $('#c-clear').dataset.armed;
  render();
  if ($('#cart').open) renderCart();
  if ($('#sheet').open && cur) openProduct(cur.id, true);
  if (admin.on && $('#admin').open) adminRender();
  if ($('#auth').open) renderAuth();
  if ($('#people').open && admin.on) peopleRender();
}
function setLang(l){ lang = l; store.set('kv-lang', l); applyLang(); }
function toggleLang(){ setLang(lang === 'ar' ? 'en' : 'ar'); }
$('#langbtn').addEventListener('click', toggleLang);
$('#g-lang').addEventListener('click', toggleLang);

/* ---------- product sheet */
var cur = null, draft = [];
function labelFor(p){ return t(p.kind === 'color' ? 'chooseColor' : p.kind === 'combo' ? 'chooseCombo' : 'chooseFlavor'); }
function stepHtml(i, q){
  return '<div class="step"><button type="button" data-i="' + i + '" data-d="-1" aria-label="' + t('remove1') + '"' + (q ? '' : ' disabled') + '>−</button>' +
    '<output>' + q + '</output><button type="button" data-i="' + i + '" data-d="1" aria-label="' + t('add1') + '">+</button></div>';
}
function openProduct(id, relang){
  var p = byId[id]; cur = p;
  var off = !isOn(p), keys = p.options.length ? p.options : [''];
  if (!relang) draft = keys.map(function(o){ return off || (o && !optOn(p, o)) ? 0 : qtyOf(p.id, o); });
  var g = 'rgb(' + p.glow.join(',') + ')';
  $('#sheet').style.setProperty('--glow', g); $('#s-media').style.setProperty('--glow', g);
  $('#s-media').classList.toggle('off', off);
  var img = $('#s-img'); img.src = p.img; img.alt = nm(p);
  $('#s-name').textContent = nm(p);
  var cat = catOf(p.cat), sub = p.sub && subOf(cat, p.sub);
  $('#s-sub').textContent = sub ? cl(sub) : cl(cat);
  $('#s-specs').innerHTML = p.specs.map(function(s){ return '<li>' + esc(trSpec(s)) + '</li>'; }).join('');
  var pr = $('#s-price');
  if (p.price != null) { pr.className = 's-price'; pr.innerHTML = moneyH(p.price) + '<small>' + t('each') + '</small>'; }
  else { pr.className = 's-price ask'; pr.textContent = t('priceOnWa'); }
  $('#s-off').hidden = !off;
  var note = $('#s-note'), nt = noteOf(p); note.hidden = !nt; note.textContent = nt;
  $('#s-label').textContent = p.options.length ? labelFor(p) : t('qty');
  $('#s-avail').textContent = p.options.length ? t('nAvail', liveOpts(p).length) : '';
  $('#s-opts').innerHTML = (p.options.length ? p.options : [t('howMany')]).map(function(o, i){
    var gone = off || (p.options.length && !optOn(p, o));
    return '<li class="opt' + (draft[i] ? ' on' : '') + (gone ? ' gone' : '') + '" data-row="' + i + '"><span class="t">' + esc(o) + '</span>' +
      (gone ? '<span class="gt">' + t('soldOut') + '</span>' : stepHtml(i, draft[i])) + '</li>';
  }).join('');
  $('#s-edit').hidden = !admin.on;
  $('#s-opts').parentNode.scrollTop = 0;
  updateAdd();
  openD($('#sheet'));
}
function updateAdd(){
  var p = cur, q = draft.reduce(function(a, b){ return a + b; }, 0), had = qtyOfProduct(p.id);
  var b = $('#s-add'), l = $('#s-add-l'), r = $('#s-add-r');
  b.disabled = false; r.textContent = '';
  if (!isOn(p)) { l.textContent = t('notNow'); b.disabled = true; }
  else if (q > 0) { l.textContent = (had ? t('updateTo', pl('item', q)) : t('addTo', pl('item', q))); r.textContent = p.price != null ? ltr(money(p.price * q)) : ''; }
  else if (had) l.textContent = t('removeFrom');
  else { l.textContent = p.options.length ? t('pickOne') : t('pickQty'); b.disabled = true; }
}
$('#s-opts').addEventListener('click', function(e){
  var b = e.target.closest('button[data-i]'); if (!b) return;
  var i = +b.dataset.i, v = Math.max(0, Math.min(99, draft[i] + +b.dataset.d));
  draft[i] = v;
  var row = b.closest('.opt'); row.classList.toggle('on', v > 0);
  row.querySelector('output').textContent = v;
  row.querySelector('[data-d="-1"]').disabled = !v;
  updateAdd();
});
$('#s-add').addEventListener('click', function(){
  var p = cur, had = qtyOfProduct(p.id), keys = p.options.length ? p.options : [''];
  keys.forEach(function(o, i){ setQty(p.id, o, draft[i]); });
  var q = draft.reduce(function(a, b){ return a + b; }, 0);
  saveCart(); closeD($('#sheet')); render();
  toast(t(q ? (had ? 'tUpdated' : 'tAdded') : 'tRemoved'));
});
$('#s-close').addEventListener('click', function(){ closeD($('#sheet')); });

/* ---------- order sheet */
function groups(){
  var order = [], map = {};
  cart.forEach(function(l){ if (!map[l.id]) { map[l.id] = []; order.push(l.id); } map[l.id].push(l); });
  return order.map(function(id){ return { p: byId[id], lines: map[id] }; });
}
function renderCart(){
  var g = groups(), tt = totals();
  $('#c-empty').hidden = g.length > 0;
  $('#c-form').hidden = !g.length; $('#c-preview').hidden = !g.length;
  $('#c-lines').innerHTML = g.map(function(x){
    var p = x.p;
    var rows = x.lines.map(function(l){
      var sub = p.price != null ? '<span class="sub"><bdi class="n">' + l.qty + ' × ' + money(p.price) + ' = ' + money(p.price * l.qty) + '</bdi></span>' : '';
      return '<div class="crow"><span class="t">' + (l.opt ? esc(l.opt) : t('qty')) + sub + '</span>' +
        '<div class="step"><button type="button" data-id="' + esc(p.id) + '" data-o="' + esc(l.opt) + '" data-d="-1" aria-label="' + t('remove1') + '">−</button><output>' + l.qty + '</output>' +
        '<button type="button" data-id="' + esc(p.id) + '" data-o="' + esc(l.opt) + '" data-d="1" aria-label="' + t('add1') + '">+</button></div></div>';
    }).join('');
    return '<div class="cl" style="--glow:rgb(' + p.glow.join(',') + ')"><span class="th"><img src="' + esc(p.img) + '" alt=""></span>' +
      '<div><div class="cn">' + esc(nm(p)) + '</div><div class="cp">' + (p.price != null ? t('cartPrice', moneyH(p.price)) : t('cartPriceWa')) + '</div></div>' +
      '<button class="rm" type="button" data-rm="' + esc(p.id) + '" aria-label="' + esc(t('removeP', nm(p))) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg></button>' +
      '<div class="rows">' + rows + '</div></div>';
  }).join('');
  $('#t-lbl').textContent = tt.fee ? t('total') + ' · ' + pl('item', tt.items) : pl('item', tt.items);
  $('#t-sum').textContent = tt.total > 0 ? ltr(money(tt.total) + (tt.unpriced ? ' +' : '')) : (tt.items ? t('toConfirm') : '');
  $('#t-sum').className = 'sum' + (tt.total > 0 ? '' : ' txt');
  $('#t-brk').hidden = !tt.fee;
  $('#t-items-row').hidden = !(tt.priced > 0);
  $('#t-items').textContent = tt.priced > 0 ? ltr(money(tt.priced)) : '';
  $('#t-fee').textContent = tt.fee ? ltr(money(tt.fee)) : '';
  var pend = $('#t-pending');
  pend.hidden = !(tt.total > 0 && tt.unpriced > 0);
  pend.textContent = tt.unpriced ? t('pendingWa', pl('item', tt.unpriced)) : '';
  updateLink();
}
function message(){
  var name = $('#f-name').value.trim(), addr = $('#f-addr').value.trim(), notes = $('#f-notes').value.trim();
  var tt = totals(), out = [];
  out.push(t('mHead'), '');
  out.push('*' + t('mName') + ':* ' + (name || '-'));
  if (addr) out.push('*' + t('mAddr') + ':* ' + addr);
  out.push('', '*' + t('mOrder') + '*');
  groups().forEach(function(x, i){
    var p = x.p;
    if (!p.options.length) {
      var l0 = x.lines[0];
      out.push((i + 1) + ') *' + p.name + '* x' + l0.qty + (p.price != null ? ' = ' + money(p.price * l0.qty) : ''));
    } else {
      out.push((i + 1) + ') *' + p.name + '*');
      x.lines.forEach(function(l){ out.push('   - ' + l.opt + ' x' + l.qty + (p.price != null ? ' = ' + money(p.price * l.qty) : '')); });
    }
  });
  out.push('');
  if (tt.fee > 0 && tt.priced > 0) out.push('*' + t('mItems') + ':* ' + ltr(money(tt.priced)));
  if (tt.fee > 0) out.push('*' + t('mDelivery') + ':* ' + ltr(money(tt.fee)));
  if (tt.total > 0) out.push('*' + t('mTotal') + ':* ' + ltr(money(tt.total)) + (tt.unpriced ? t('mPlus', pl('item', tt.unpriced)) : ''));
  else out.push('*' + t('mTotal') + ':* ' + t('mTbc'));
  if (notes) out.push('', '*' + t('mNotes') + ':* ' + notes);
  return out.join('\n');
}
function updateLink(){
  var a = $('#wa'), empty = !cart.length;
  var msg = empty ? '' : message();
  $('#c-msg').value = msg;
  a.href = empty ? '#' : 'https://wa.me/' + SHOP.phone + '?text=' + encodeURIComponent(msg);
  a.setAttribute('aria-disabled', empty ? 'true' : 'false');
}
$('#c-lines').addEventListener('click', function(e){
  var rm = e.target.closest('[data-rm]');
  if (rm) { var id = rm.dataset.rm; cart = cart.filter(function(l){ return l.id !== id; }); }
  else {
    var b = e.target.closest('button[data-d]'); if (!b) return;
    setQty(b.dataset.id, b.dataset.o, Math.min(99, qtyOf(b.dataset.id, b.dataset.o) + +b.dataset.d));
  }
  hideWaHelp(); saveCart(); render(); renderCart();
});
['f-name', 'f-addr', 'f-notes'].forEach(function(id){
  var el = $('#' + id);
  el.addEventListener('input', function(){
    if (id !== 'f-notes') store.set('kv-' + id, el.value);
    if (id === 'f-name' && el.value.trim()) $('#f-err').hidden = true;
    hideWaHelp();
    updateLink();
  });
});
$('#f-name').value = store.get('kv-f-name') || '';
$('#f-addr').value = store.get('kv-f-addr') || '';
/* The page cannot tell whether WhatsApp really opened (an app view may swallow the link), so after a send we
   wait a moment and, if this page was never put in the background, offer copy-and-paste as a backup. */
var waTimer = 0, waLeft = false;
/* iPhone, inside the claude.ai viewer (a frame): it does not pass new-tab links on to Safari, so go straight to the WhatsApp app with its own address.
   On a normal website (not framed) the usual wa.me link is used.
   (window.__kvNav is only a hook for tests.) */
var FRAMED = (function(){ try { return window.top !== window.self; } catch (e) { return true; } })();
var IOS = FRAMED && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
function waApp(text){ return 'whatsapp://send?phone=' + SHOP.phone + (text ? '&text=' + encodeURIComponent(text) : ''); }
function navTo(url){ try { if (window.__kvNav) window.__kvNav(url); else window.location.href = url; } catch (e) {} }
function showWaHelp(on){ $('#wa-help').hidden = !on; document.querySelector('.c-foot').classList.toggle('help', on); }
function hideWaHelp(){ clearTimeout(waTimer); showWaHelp(false); }
document.addEventListener('visibilitychange', function(){ if (document.hidden) waLeft = true; });
window.addEventListener('pagehide', function(){ waLeft = true; });
$('#wa').addEventListener('click', function(e){
  if (!cart.length) { e.preventDefault(); return; }
  if (!$('#f-name').value.trim()) {
    e.preventDefault(); $('#f-err').hidden = false; toast(t('fErrT'), true);
    var f = $('#f-name'); try { f.scrollIntoView({ block: 'center' }); } catch (x) {} f.focus(); return;
  }
  updateLink();
  toast(t('opening'));
  if (IOS) { e.preventDefault(); navTo(waApp($('#c-msg').value)); }
  waLeft = false; clearTimeout(waTimer);
  waTimer = setTimeout(function(){ if (!waLeft && $('#cart').open) { showWaHelp(true); } }, 2500);
});
function copyMsg(){
  var ta = $('#c-msg'), text = ta.value;
  function fallback(){ ta.focus(); ta.select(); try { document.execCommand('copy'); toast(t('copied')); } catch (e) { toast(t('copyFail')); } }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ toast(t('copied')); }, fallback); else fallback();
}
$('#c-copy').addEventListener('click', copyMsg);
$('#wa-copy').addEventListener('click', function(){ updateLink(); copyMsg(); });
$('#wa-chat').addEventListener('click', function(e){ if (IOS) { e.preventDefault(); navTo(waApp('')); } });
$('#cart').addEventListener('close', hideWaHelp);
var clearTimer;
$('#c-clear').addEventListener('click', function(){
  var b = this;
  if (b.dataset.armed) { cart = []; saveCart(); delete b.dataset.armed; b.textContent = t('clear'); render(); renderCart(); closeD($('#cart')); toast(t('tCleared')); return; }
  b.dataset.armed = '1'; b.textContent = t('clear2');
  clearTimeout(clearTimer); clearTimer = setTimeout(function(){ delete b.dataset.armed; b.textContent = t('clear'); }, 3000);
});
function openCart(){ renderCart(); openD($('#cart')); }
$('#cartbtn').addEventListener('click', openCart);
$('#orderbar').addEventListener('click', openCart);
$('#c-close').addEventListener('click', function(){ closeD($('#cart')); });
$('#c-browse').addEventListener('click', function(){ closeD($('#cart')); });

/* ---------- age gate */
var gate = $('#gate');
gate.addEventListener('cancel', function(e){ e.preventDefault(); });
$('#g-yes').addEventListener('click', function(){ store.set('kv-18', 'yes'); gate.close(); });
$('#g-no').addEventListener('click', function(){ $('#g-ask').hidden = true; $('#g-block').hidden = false; });
